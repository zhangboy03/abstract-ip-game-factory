import numpy as np
import sounddevice as sd
from scipy import signal
import random
import threading
import queue
import time

class AudioProcessor:
    def __init__(self):
        self.sample_rate = 44100
        self.chunk_size = 1024 * 4  # 增大缓冲区
        self.current_mode = None
        self.audio_queue = queue.Queue(maxsize=10)
        self.output_queue = queue.Queue(maxsize=10)
        self.is_processing = False
        self.distracted = False
        self.pitch_shift_factor = 1.3  # 分心时的音调变化因子
        
    def start_processing(self):
        self.is_processing = True
        threading.Thread(target=self._process_audio_loop, daemon=True).start()
        
    def stop_processing(self):
        self.is_processing = False
        
    def _process_audio_loop(self):
        while self.is_processing:
            try:
                audio_chunk = self.audio_queue.get(timeout=0.1)
                processed = self.process_audio(audio_chunk, self.distracted)
                self.output_queue.put(processed)
            except queue.Empty:
                continue
                
    def set_distraction_state(self, is_distracted):
        """更新分心状态"""
        if self.distracted != is_distracted:
            self.distracted = is_distracted
            if is_distracted:
                self.current_mode = random.choice([
                    'volume_down',
                    'volume_up',
                    'pitch_up',
                    'pitch_down'
                ])
                
    def process_audio(self, audio_chunk, distracted):
        """处理音频数据"""
        if not distracted:
            return audio_chunk
            
        # 分心时改变音调
        return self.pitch_shift(audio_chunk, self.pitch_shift_factor)

    def pitch_shift(self, audio_chunk, factor):
        return signal.resample(audio_chunk, int(len(audio_chunk) / factor))

    def generate_beep(self, duration=0.1, frequency=440):
        t = np.linspace(0, duration, int(self.sample_rate * duration))
        return np.sin(2 * np.pi * frequency * t)
