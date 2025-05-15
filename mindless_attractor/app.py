from flask import Flask, render_template, jsonify, request, Response, url_for
from flask_socketio import SocketIO
from datetime import datetime  # Add this import
import cv2
import threading
import base64
import numpy as np
import socket
from controller import AttentionController
import logging
from queue import Queue
import asyncio
from pydub import AudioSegment
import wave
import tempfile
import os
import time
import json
import numpy as np
import signal

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def find_free_port(start_port=5000, max_port=5020):
    """找到一个可用的端口"""
    for port in range(start_port, max_port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('127.0.0.1', port))
            s.close()
            return port
        except OSError:
            continue
    raise OSError("Could not find a free port")

class CameraManager:
    def __init__(self):
        self.active = False
        self.cap = None
        self.frame_queue = Queue(maxsize=10)
        self.lock = threading.Lock()
        self.get_frame_lock = threading.Lock()
        self.frame = None
        self.camera_initialized = False

    def start(self):
        with self.lock:
            if not self.active:
                try:
                    # 尝试多个摄像头索引
                    for camera_index in [0, 1]:
                        self.cap = cv2.VideoCapture(camera_index)
                        if self.cap.isOpened():
                            break
                    
                    if not self.cap.isOpened():
                        logger.error("Failed to open camera")
                        return False
                    
                    # Set camera properties with error checking
                    props = {
                        cv2.CAP_PROP_FRAME_WIDTH: 640,
                        cv2.CAP_PROP_FRAME_HEIGHT: 480,
                        cv2.CAP_PROP_FPS: 30,
                        cv2.CAP_PROP_BUFFERSIZE: 1
                    }
                    
                    for prop, value in props.items():
                        if not self.cap.set(prop, value):
                            logger.warning(f"Failed to set camera property {prop}")
                    
                    # 确保可以读取帧
                    ret, _ = self.cap.read()
                    if not ret:
                        logger.error("Cannot read frame from camera")
                        self.cap.release()
                        return False
                    
                    self.active = True
                    self.camera_initialized = True
                    threading.Thread(target=self._capture_loop, daemon=True).start()
                    return True
                except Exception as e:
                    logger.error(f"Camera initialization error: {e}")
                    if self.cap:
                        self.cap.release()
                    return False
            return True

    def stop(self):
        with self.lock:
            self.active = False
            if self.cap:
                self.cap.release()
                self.cap = None

    def _capture_loop(self):
        retry_count = 0
        while self.active:
            try:
                if not self.cap or not self.cap.isOpened():
                    if retry_count < 3:
                        logger.warning("Attempting to reopen camera...")
                        self.cap = cv2.VideoCapture(0)
                        retry_count += 1
                        time.sleep(1)
                        continue
                    else:
                        logger.error("Failed to reopen camera after 3 attempts")
                        break

                ret, frame = self.cap.read()
                if ret:
                    with self.get_frame_lock:
                        self.frame = frame
                        retry_count = 0
                else:
                    logger.warning("Failed to read frame")
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"Error in capture loop: {e}")
                time.sleep(0.1)

    def get_frame(self):
        with self.get_frame_lock:
            return self.frame.copy() if self.frame is not None else None

class VideoAudioProcessor:
    def __init__(self, audio_processor):
        self.audio_processor = audio_processor
        self.original_audio = None
        self.processed_audio = None
        
    def load_video_audio(self, video_path):
        # 提取视频音频
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
            os.system(f'ffmpeg -i "{video_path}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "{temp_audio.name}"')
            self.original_audio = AudioSegment.from_wav(temp_audio.name)
        os.unlink(temp_audio.name)
        
    def process_audio(self, is_distracted):
        if self.original_audio is None:
            return
            
        chunk = self.original_audio[0:1000]  # 处理1秒的音频
        processed_chunk = self.audio_processor.process_audio(chunk, is_distracted)
        self.processed_audio = processed_chunk

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

def to_json_serializable(obj):
    """转换数据为JSON可序列化格式"""
    if isinstance(obj, dict):
        return {k: to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_json_serializable(i) for i in obj]
    elif isinstance(obj, (np.integer, np.floating, np.bool_)):
        return obj.item()
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['JSON_AS_ASCII'] = False
app.config['CORS_HEADERS'] = 'Content-Type'

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    json=json,
    json_encoder=NumpyEncoder,
    ping_timeout=5000,
    ping_interval=2000,
    manage_session=False,
    namespace='/'
)

controller = AttentionController()
camera_manager = CameraManager()
video_processor = VideoAudioProcessor(controller.audio_processor)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/set_intervention', methods=['POST'])
def set_intervention():
    intervention_type = request.json.get('type')
    controller.set_intervention_type(intervention_type)
    return jsonify({'status': 'success'})

@app.route('/api/start', methods=['POST'])
def start_monitoring():
    if not camera_manager.start():
        return jsonify({'status': 'error', 'message': 'Failed to start camera'}), 500
    video_processor.audio_processor.start_processing()
    threading.Thread(target=process_frames, daemon=True).start()
    return jsonify({'status': 'success'})

@app.route('/api/stop', methods=['POST'])
def stop_monitoring():
    camera_manager.stop()
    video_processor.audio_processor.stop_processing()
    return jsonify({'status': 'success'})

@app.route('/api/upload_video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file'}), 400
        
    video = request.files['video']
    video_path = os.path.join(tempfile.gettempdir(), 'temp_video.mp4')
    video.save(video_path)
    video_processor.load_video_audio(video_path)
    return jsonify({'status': 'success'})

def process_frames():
    frame_count = 0
    last_process_time = time.time()
    
    while camera_manager.active:
        try:
            current_time = time.time()
            if current_time - last_process_time < 0.1:  # Limit to 10 updates per second
                time.sleep(0.01)
                continue
                
            frame = camera_manager.get_frame()
            if frame is not None:
                frame_count += 1
                last_process_time = current_time
                
                # Process every 3rd frame
                if frame_count % 3 == 0:
                    distracted, result, vis_frame = controller.head_detector.is_distracted(frame)
                    result = to_json_serializable(result)
                    status_data = {
                        'distracted': bool(distracted),
                        'timestamp': datetime.now().isoformat(),
                        'reason': result
                    }
                    try:
                        socketio.emit('attention_status', status_data)
                    except Exception as e:
                        logger.error(f"Socket emit error: {e}")
            time.sleep(0.1)
        except Exception as e:
            logger.error(f"Error in process_frames: {e}")
            time.sleep(0.1)

def generate_frames():
    frame_count = 0
    last_frame_time = time.time()
    
    while True:
        try:
            current_time = time.time()
            if current_time - last_frame_time < 0.033:  # Limit to ~30 FPS
                time.sleep(0.01)
                continue
                
            frame = camera_manager.get_frame()
            if frame is not None:
                frame_count += 1
                last_frame_time = current_time
                
                # Process every 3rd frame for visualization
                if frame_count % 3 == 0:
                    distracted, result, vis_frame = controller.head_detector.is_distracted(frame)
                    if vis_frame is not None:
                        ret, buffer = cv2.imencode('.jpg', vis_frame)
                        if ret:
                            frame_bytes = buffer.tobytes()
                            yield (b'--frame\r\n'
                                  b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            else:
                time.sleep(0.033)
        except Exception as e:
            logger.error(f"Error in generate_frames: {e}")
            logger.error(traceback.format_exc())
            time.sleep(0.1)

@app.route('/video_feed')
def video_feed():
    try:
        return Response(generate_frames(),
                       mimetype='multipart/x-mixed-replace; boundary=frame')
    except Exception as e:
        logger.error(f"Error in video_feed: {e}")
        return "Video feed error", 500

# 添加 Socket.IO 事件处理
@socketio.on('connect', namespace='/')
def handle_connect():
    logger.info("Client connected")
    socketio.emit('status', {'connected': True}, namespace='/')

@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    logger.info("Client disconnected")
    
@socketio.on_error_default
def default_error_handler(e):
    logger.error(f'SocketIO error: {str(e)}')
    return False  # 防止错误传播

def cleanup():
    """清理资源"""
    camera_manager.stop()
    # Remove cv2.destroyAllWindows() since we're using headless OpenCV

import traceback

# Update main execution
if __name__ == '__main__':
    try:
        port = find_free_port()
        logger.info(f"Server is running at http://localhost:{port}")
        logger.info(f"Please open http://localhost:{port} in your browser")
        
        socketio.init_app(app)
        socketio.run(app, 
                    host='127.0.0.1',
                    port=port,
                    debug=False,
                    log_output=True,
                    use_reloader=False)
    except Exception as e:
        logger.error(f"Error starting server: {e}")
        logger.error(traceback.format_exc())
    finally:
        cleanup()
