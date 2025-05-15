import cv2
import mediapipe as mp
import numpy as np
from collections import deque
from time import time

class HeadPoseDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            static_image_mode=False  # Add this for better performance
        )
        
        # 姿态角度阈值
        self.YAW_THRESHOLD = 15    # 左右偏转角度阈值
        self.PITCH_THRESHOLD = 20  # 上下点头角度阈值
        self.ROLL_THRESHOLD = 20   # 头部倾斜角度阈值
        
        # 眨眼检测
        self.blink_history = deque(maxlen=30)  # 存储最近30帧的眨眼状态
        self.last_blink_time = time()
        self.EAR_THRESHOLD = 0.15   # 降低眨眼检测敏感度
        self.CLOSED_EYES_TIME = 2.0  # 闭眼超过2秒视为分心
        self.last_closed_time = None  # 记录开始闭眼的时间
        self.BLINK_FREQUENCY_THRESHOLD = 0.5  # 每秒眨眼次数阈值

        # 增加视线方向计算所需的3D参考点
        self.face_3d = np.array([
            [0.0, 0.0, 0.0],    # 鼻尖
            [0.0, -330.0, -65.0],  # 下巴
            [-225.0, 170.0, -135.0],  # 左眼左角
            [225.0, 170.0, -135.0],   # 右眼右角
            [-150.0, -150.0, -125.0], # 左嘴角
            [150.0, -150.0, -125.0]   # 右嘴角
        ], dtype=np.float64)

        # 眼睛关键点索引
        self.LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]  # 左眼6个关键点
        self.RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]  # 右眼6个关键点

        self.DRAW_COLOR = {
            'normal': (0, 255, 0),  # 绿色
            'warning': (0, 165, 255),  # 橙色
            'distracted': (0, 0, 255)  # 红色
        }

    def get_face_landmarks(self, frame):
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(frame_rgb)
        
        if not results.multi_face_landmarks:
            return None
            
        landmarks = results.multi_face_landmarks[0].landmark
        return np.array([[lm.x * frame.shape[1], lm.y * frame.shape[0], lm.z * 3000] 
                        for lm in landmarks])

    def calculate_ear(self, landmarks, eye_indices):
        """计算眼睛纵横比 (Eye Aspect Ratio)"""
        eye_points = np.array([[landmarks[idx][0], landmarks[idx][1]] for idx in eye_indices])
        
        # 垂直方向
        v1 = np.linalg.norm(eye_points[1] - eye_points[5])
        v2 = np.linalg.norm(eye_points[2] - eye_points[4])
        # 水平方向
        h = np.linalg.norm(eye_points[0] - eye_points[3])
        # 计算EAR
        return (v1 + v2) / (2.0 * h) if h > 0 else 0.0

    def draw_face_state(self, frame, landmarks, is_distracted, yaw_angle):
        """在图像上绘制面部状态可视化"""
        h, w = frame.shape[:2]
        
        # 绘制面部关键点连线
        connections = [(33, 133), (33, 362), (362, 263), (263, 133)]
        for start_idx, end_idx in connections:
            pt1 = np.array([int(landmarks[start_idx][0]), int(landmarks[start_idx][1])])
            pt2 = np.array([int(landmarks[end_idx][0]), int(landmarks[end_idx][1])])
            color = self.DRAW_COLOR['distracted'] if is_distracted else self.DRAW_COLOR['normal']
            cv2.line(frame, pt1, pt2, color, 2)

        # 绘制头部朝向指示器
        nose_tip = (int(landmarks[1][0]), int(landmarks[1][1]))
        nose_length = 100
        yaw_rad = np.deg2rad(yaw_angle)
        
        end_point = (
            int(nose_tip[0] + nose_length * np.sin(yaw_rad)),
            int(nose_tip[1])
        )
        
        # 根据偏转角度选择颜色
        if abs(yaw_angle) > self.YAW_THRESHOLD:
            color = self.DRAW_COLOR['distracted']
        elif abs(yaw_angle) > self.YAW_THRESHOLD * 0.7:  # 警告阈值
            color = self.DRAW_COLOR['warning']
        else:
            color = self.DRAW_COLOR['normal']
            
        # 绘制头部方向指示箭头
        cv2.arrowedLine(frame, nose_tip, end_point, color, 2, tipLength=0.2)
        
        # 添加角度文本
        cv2.putText(frame, f'Yaw: {yaw_angle:.1f}°', 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        return frame

    def calculate_head_pose(self, landmarks):
        """计算头部姿态角度"""
        left_eye = np.mean(landmarks[self.LEFT_EYE_INDICES], axis=0)
        right_eye = np.mean(landmarks[self.RIGHT_EYE_INDICES], axis=0)
        nose_tip = landmarks[1]
        
        # 计算偏航角(左右转头)
        eye_center = (left_eye + right_eye) / 2
        dx = eye_center[0] - nose_tip[0]
        dz = eye_center[2] - nose_tip[2] if len(nose_tip) > 2 else 1
        yaw = np.arctan2(dx, abs(dz)) * 180 / np.pi
        
        # 计算俯仰角(上下点头)
        dy = eye_center[1] - nose_tip[1]
        pitch = np.arctan2(dy, abs(dz)) * 180 / np.pi
        
        return yaw, pitch

    def check_eyes_closed(self, avg_ear):
        """检测持续闭眼状态"""
        current_time = time()
        
        if avg_ear < self.EAR_THRESHOLD:  # 眼睛闭合
            if self.last_closed_time is None:
                self.last_closed_time = current_time
            elif current_time - self.last_closed_time >= self.CLOSED_EYES_TIME:
                return True, current_time - self.last_closed_time
        else:  # 眼睛睁开
            self.last_closed_time = None
        
        return False, 0

    def is_distracted(self, frame):
        try:
            landmarks = self.get_face_landmarks(frame)
            if landmarks is None:
                return True, {
                    "head_pose": {"yaw": None, "pitch": None},
                    "eyes": {"closed": None, "closed_duration": None},
                    "attention_level": "unknown",
                    "reason": "No face detected"
                }, None
                
            # 计算头部姿态
            yaw, pitch = self.calculate_head_pose(landmarks)
            
            # 检测眼睛状态
            left_ear = self.calculate_ear(landmarks, self.LEFT_EYE_INDICES)
            right_ear = self.calculate_ear(landmarks, self.RIGHT_EYE_INDICES)
            avg_ear = (left_ear + right_ear) / 2
            
            # 检测持续闭眼
            eyes_closed, closed_duration = self.check_eyes_closed(avg_ear)
            
            # 判断分心状态 - 仅使用头部角度和闭眼状态
            is_distracted = (
                abs(yaw) > self.YAW_THRESHOLD or
                abs(pitch) > self.PITCH_THRESHOLD or
                (eyes_closed and closed_duration >= self.CLOSED_EYES_TIME)
            )
            
            # 绘制可视化效果
            vis_frame = frame.copy()
            vis_frame = self.draw_face_state(vis_frame, landmarks, is_distracted, yaw)
            
            return is_distracted, {
                "head_pose": {
                    "yaw": float(yaw) if yaw is not None else None,
                    "pitch": float(pitch) if pitch is not None else None
                },
                "eyes": {
                    "closed": bool(eyes_closed),
                    "closed_duration": float(closed_duration) if closed_duration else None
                },
                "attention_level": "distracted" if is_distracted else "focused"
            }, vis_frame
            
        except Exception as e:
            logger.error(f"Error in is_distracted: {e}")
            return True, {
                "head_pose": {"yaw": None, "pitch": None},
                "eyes": {"closed": None, "closed_duration": None},
                "attention_level": "unknown",
                "reason": str(e)
            }, None

    def __del__(self):
        self.face_mesh.close()
