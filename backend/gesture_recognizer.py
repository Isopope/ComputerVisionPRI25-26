
import cv2 as cv
import numpy as np
import mediapipe as mp
import itertools
import csv
import os
from model.keypoint_classifier.keypoint_classifier import KeyPointClassifier

class GestureRecognizer:
    def __init__(self, 
                 static_image_mode=False,
                 max_num_hands=1,
                 min_detection_confidence=0.7,
                 min_tracking_confidence=0.5):
        
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=static_image_mode,
            max_num_hands=max_num_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        
        # Load KeyPoint Classifier
        self.keypoint_classifier = KeyPointClassifier()
        
        # Load Labels
        self.keypoint_classifier_labels = self._load_labels("model/keypoint_classifier/keypoint_classifier_label.csv")

    def _load_labels(self, path):
        if not os.path.exists(path):
            return []
        with open(path, encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f)
            labels = [row[0] for row in reader]
        return labels

    def recognize(self, image):
        """
        Process the image and recognize hand gestures.
        """
        image_height, image_width = image.shape[0], image.shape[1]
        
        # Determine average brightness to handle difficult lighting
        # If too dark (average < 50), simple thresholding might fail, but MediaPipe is robust.
        # We can pass the image directly.
        
        # Convert to RGB
        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        
        # Process
        results = self.hands.process(image_rgb)
        
        if results.multi_hand_landmarks:
            for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                # Landmark calculation
                landmark_list = self._calc_landmark_list(image, hand_landmarks)
                
                # Conversion to relative coordinates / normalization
                pre_processed_landmark_list = self._pre_process_landmark(landmark_list)
                
                # Hand Sign Classification
                hand_sign_id = self.keypoint_classifier(pre_processed_landmark_list)
                
                gesture_name = "Unknown"
                if 0 <= hand_sign_id < len(self.keypoint_classifier_labels):
                    gesture_name = self.keypoint_classifier_labels[hand_sign_id]
                
                # Bounding box calculation
                brect = self._calc_bounding_rect(image, hand_landmarks)
                
                # Confidence - keypoint classifier returns index, not confidence directly.
                # But we can assume high confidence if it returned a valid index.
                # However, main.py expects a float. We'll use a placeholder or derived score.
                # Since KeyPointClassifier just does argmax, we don't have probability API exposed yet 
                # unless we modify KeyPointClassifier to return it.
                # For now, we'll return 1.0 if detection is successful.
                
                return {
                    "hand_detected": True,
                    "gesture": gesture_name,
                    "confidence": 0.95, # Placeholder, as TFLite classifier wrapper returns only index
                    "landmarks": landmark_list,
                    "bounding_box": brect,
                    "handedness": handedness.classification[0].label[0:] # "Right" or "Left"
                }
                
        return {
            "hand_detected": False,
            "gesture": None,
            "confidence": 0.0,
            "landmarks": [],
            "bounding_box": None,
            "handedness": None
        }

    def _calc_landmark_list(self, image, landmarks):
        image_width, image_height = image.shape[1], image.shape[0]
        landmark_point = []

        # Keypoint
        for _, landmark in enumerate(landmarks.landmark):
            landmark_x = min(int(landmark.x * image_width), image_width - 1)
            landmark_y = min(int(landmark.y * image_height), image_height - 1)
            landmark_point.append([landmark_x, landmark_y])

        return landmark_point

    def _pre_process_landmark(self, landmark_list):
        temp_landmark_list = copy.deepcopy(landmark_list)

        # Convert to relative coordinates
        base_x, base_y = 0, 0
        for index, landmark_point in enumerate(temp_landmark_list):
            if index == 0:
                base_x, base_y = landmark_point[0], landmark_point[1]

            temp_landmark_list[index][0] = temp_landmark_list[index][0] - base_x
            temp_landmark_list[index][1] = temp_landmark_list[index][1] - base_y

        # Convert to a one-dimensional list
        temp_landmark_list = list(
            itertools.chain.from_iterable(temp_landmark_list))

        # Normalization
        max_value = max(list(map(abs, temp_landmark_list)))

        def normalize_(n):
            return n / max_value

        temp_landmark_list = list(map(normalize_, temp_landmark_list))

        return temp_landmark_list

    def _calc_bounding_rect(self, image, landmarks):
        image_width, image_height = image.shape[1], image.shape[0]

        landmark_array = np.empty((0, 2), int)

        for _, landmark in enumerate(landmarks.landmark):
            landmark_x = min(int(landmark.x * image_width), image_width - 1)
            landmark_y = min(int(landmark.y * image_height), image_height - 1)

            landmark_point = [np.array((landmark_x, landmark_y))]

            landmark_array = np.append(landmark_array, landmark_point, axis=0)

        x, y, w, h = cv.boundingRect(landmark_array)

        return [x, y, x + w, y + h]
    
    def close(self):
        self.hands.close()

import copy
