import asyncio
import websockets
import json
import cv2
import logging
from datetime import datetime
from head_pose_detector import HeadPoseDetector
from audio_processor import AudioProcessor

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AttentionController:
    def __init__(self):
        self.head_detector = HeadPoseDetector()
        self.audio_processor = AudioProcessor()
        self.intervention_type = None
        self.distraction_timestamps = []
        
    def process_frame(self, frame):  # Remove async
        try:
            distracted, reason, vis_frame = self.head_detector.is_distracted(frame)
            timestamp = datetime.now().isoformat()
            
            if distracted:
                self.distraction_timestamps.append(timestamp)
            
            return {
                'distracted': bool(distracted),
                'timestamp': timestamp,
                'total_distractions': len(self.distraction_timestamps),
                'reason': reason
            }
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            return {
                'distracted': True,
                'timestamp': datetime.now().isoformat(),
                'total_distractions': len(self.distraction_timestamps),
                'reason': {'error': str(e)}
            }

    def set_intervention_type(self, type_name):
        """Set intervention type: 'mindless', 'warning', or 'control'"""
        self.intervention_type = type_name

    async def websocket_handler(self, websocket, path):
        try:
            async for message in websocket:
                data = json.loads(message)
                if 'frame' in data:
                    frame = cv2.imdecode(np.frombuffer(data['frame'], np.uint8), cv2.IMREAD_COLOR)
                    result = await self.process_frame(frame)
                    await websocket.send(json.dumps(result))
        except websockets.exceptions.ConnectionClosed:
            pass

async def main():
    controller = AttentionController()
    server = await websockets.serve(
        controller.websocket_handler,
        "localhost",
        8765
    )
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
