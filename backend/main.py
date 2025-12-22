from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn
import base64
import io
import time
import os
import numpy as np
from PIL import Image
import cv2 as cv
from ultralytics import YOLO
from collections import Counter, deque
from gesture_recognizer import GestureRecognizer
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles globaux
MODEL_PATH = "dobble.pt"
model = None
recognizer = None  # GestureRecognizer singleton

@app.on_event("startup")
async def load_models():
    global model, recognizer
    
    # Charger modèle YOLO Dobble
    try:
        if os.path.exists(MODEL_PATH):
            model = YOLO(MODEL_PATH, task='detect')
            print(f"✅ Modèle Dobble (dobble.pt) chargé avec succès")
        else:
            print(f"⚠️ Modèle Dobble non trouvé: {MODEL_PATH}")
    except Exception as e:
        print(f"❌ Erreur chargement modèle YOLO: {e}")
        model = None
    
    # Initialiser GestureRecognizer pour gestes Dino
    try:
        recognizer = GestureRecognizer()
        print(f"✅ GestureRecognizer initialisé avec succès")
    except Exception as e:
        print(f"❌ Erreur initialisation GestureRecognizer: {e}")
        recognizer = None


@app.on_event("shutdown")
async def shutdown_event():
    """Libère les ressources"""
    global recognizer
    if recognizer:
        recognizer.close()
    print("👋 GestureRecognizer fermé")

class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    confidence: float
    label: str

class AnalyzeDobbleRequest(BaseModel):
    image: str
    confidence_threshold: Optional[float] = 0.3
    draw_boxes: Optional[bool] = True

class DetectGestureRequest(BaseModel):
    image: str  # base64 image (peut être avec ou sans data:image/jpeg;base64, prefix)

class Landmark(BaseModel):
    x: float
    y: float
    z: float

class DetectGestureResponse(BaseModel):
    gesture: str  # "jump", "duck", "neutral"
    confidence: float
    landmarks: Optional[List[Dict]] = None

def decode_base64_image(data_url: str) -> np.ndarray:
    try:
        if "," in data_url:
            base64_data = data_url.split(",")[1]
        else:
            base64_data = data_url
        
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        image_np = np.array(image)
        
        if len(image_np.shape) == 3 and image_np.shape[2] == 3:
            image_np = cv.cvtColor(image_np, cv.COLOR_RGB2BGR)
        
        return image_np
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

def calc_landmark_list(image: np.ndarray, landmarks) -> List[Dict]:
    """Extrait les coordonnées des 21 points clés de la main"""
    image_height, image_width = image.shape[:2]
    landmark_points = []
    
    for landmark in landmarks.landmark:
        landmark_points.append({'x': float(landmark.x), 'y': float(landmark.y), 'z': float(landmark.z)})
    
    return landmark_points

def pre_process_landmark(landmark_list: List[Dict]) -> List[float]:
    """Normalise les landmarks pour la classification"""
    temp_landmark_list = []
    
    # Conversion en coordonnées relatives au poignet (point 0)
    base_x = landmark_list[0]['x']
    base_y = landmark_list[0]['y']
    
    for landmark in landmark_list:
        temp_landmark_list.append([
            landmark['x'] - base_x,
            landmark['y'] - base_y
        ])
    
    # Aplatissement
    temp_landmark_list = list(itertools.chain.from_iterable(temp_landmark_list))
    
    # Normalisation par valeur max
    max_value = max(list(map(abs, temp_landmark_list)))
    if max_value == 0:
        max_value = 1
    
    temp_landmark_list = [n / max_value for n in temp_landmark_list]
    
    return temp_landmark_list

def classify_gesture(landmark_list: List[float]) -> tuple:
    """
    Classifie le geste basé sur les landmarks
    Mapping:
    - Poing fermé (Closed_Fist) → "jump" (ou ignore)
    - Poing ouvert (Open_Palm) ou OK → "jump"
    - Autre → "neutral"
    
    Returns: (gesture_name, confidence)
    """
    if len(landmark_list) != 42:
        return ("neutral", 0.0)
    
    # Calcul des distances entre les doigts et la paume
    # Point 0 = poignet, 4=bout pouce, 8=bout index, 12=bout majeur, 16=bout annulaire, 20=bout auriculaire
    
    landmarks_np = np.array(landmark_list).reshape((21, 2))
    
    # Distance entre poignet et bouts des doigts
    wrist = landmarks_np[0]
    thumb_tip = landmarks_np[4]
    index_tip = landmarks_np[8]
    middle_tip = landmarks_np[12]
    ring_tip = landmarks_np[16]
    pinky_tip = landmarks_np[20]
    
    # Distances
    dist_thumb = np.linalg.norm(thumb_tip - wrist)
    dist_index = np.linalg.norm(index_tip - wrist)
    dist_middle = np.linalg.norm(middle_tip - wrist)
    dist_ring = np.linalg.norm(ring_tip - wrist)
    dist_pinky = np.linalg.norm(pinky_tip - wrist)
    
    # Moyenne des distances
    avg_dist = np.mean([dist_thumb, dist_index, dist_middle, dist_ring, dist_pinky])
    
    # Calcul des angles (ouverture de la main)
    # Si tous les doigts sont loin = poing ouvert = JUMP
    # Si tous les doigts sont près = poing fermé
    
    if keypoint_classifier is None:
        return ("neutral", 0.0)
    
    # Appeler le classifier TFLite
    gesture_id = keypoint_classifier(landmark_list)
    
    # Récupérer le label du geste
    if gesture_id < len(keypoint_classifier_labels):
        gesture_name = keypoint_classifier_labels[gesture_id]
    else:
        gesture_name = "unknown"
    
    # Conversion des labels du modèle vers les actions du jeu Dino
    # Le modèle reconnaît: Open, Close, Pointer, OK
    # Tous les gestes = jump (sauf erreur de détection)
    gesture_map = {
        "Open": "jump",      # Paume ouverte = sauter
        "Close": "jump",     # Poing fermé = sauter
        "OK": "jump",        # Signe OK = sauter
        "Pointer": "jump"    # Doigt pointeur = sauter
    }
    
    mapped_gesture = gesture_map.get(gesture_name, "neutral")
    confidence = 0.9  # Le classifier TFLite ne retourne pas la confiance directement
    
    return (mapped_gesture, confidence)

def analyze_duplicates(detection_data: List[Dict]) -> Dict:
    if not detection_data:
        return {}
    
    symbols = [d['classe'] for d in detection_data]
    symbol_counts = Counter(symbols)
    duplicates = {s: c for s, c in symbol_counts.items() if c == 2}
    
    return duplicates

def convert_to_percentage(bbox, image_width: int, image_height: int) -> Dict:
    xmin, ymin, xmax, ymax = bbox
    
    return {
        "x": (xmin / image_width) * 100,
        "y": (ymin / image_height) * 100,
        "width": ((xmax - xmin) / image_width) * 100,
        "height": ((ymax - ymin) / image_height) * 100
    }

def draw_bounding_boxes(image: np.ndarray, duplicate_detections: List[Dict]) -> str:
    image_copy = image.copy()
    
    for det in duplicate_detections:
        xmin, ymin, xmax, ymax = det['bbox']
        conf = det['confiance']
        label = det['classe']
        
        cv.rectangle(image_copy, (xmin, ymin), (xmax, ymax), (0, 255, 0), 4)
        
        label_text = f'{label} ({int(conf*100)}%)'
        cv.putText(image_copy, label_text, (xmin, ymin-15),
                   cv.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    
    image_rgb = cv.cvtColor(image_copy, cv.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb)
    buffer = io.BytesIO()
    pil_image.save(buffer, format="JPEG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/jpeg;base64,{img_str}"

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "message": "Backend operational",
        "models": {
            "dobble": {
                "status": "loaded" if model else "not_loaded",
                "path": MODEL_PATH,
                "classes": list(model.names.values()) if model else [],
                "num_classes": len(model.names) if model else 0
            },
            "gesture": {
                "status": "loaded" if recognizer else "not_loaded",
                "type": "GestureRecognizer (MediaPipe + TFLite)",
                "gestures": ["Open", "Close", "Pointer", "OK"],
                "game_actions": ["jump", "duck", "neutral"]
            }
        }
    }

@app.post("/api/analyze/dobble")
async def analyze_dobble(request: AnalyzeDobbleRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    start_time = time.time()
    
    try:
        image = decode_base64_image(request.image)
        image_height, image_width = image.shape[:2]
        
        results = model(image, conf=request.confidence_threshold, verbose=False)
        detections = results[0].boxes if results and len(results) > 0 else None
        
        if detections is None or len(detections) == 0:
            return {
                "success": True,
                "detected": False,
                "result": {
                    "label": "",
                    "confidence": 0.0,
                    "processing_time": time.time() - start_time,
                    "annotated_image": "",
                    "bounding_boxes": [],
                    "detections_detailed": [],
                    "classes_detected": []
                },
                "metadata": {
                    "model": MODEL_PATH,
                    "model_classes": list(model.names.values()),
                    "total_detections": 0,
                    "confidence_threshold": request.confidence_threshold,
                    "image_processed_at_640x640": False
                }
            }
        
        detection_data = []
        for i, det in enumerate(detections):
            xyxy = det.xyxy.cpu().numpy().squeeze()
            if len(xyxy.shape) == 1:
                xmin, ymin, xmax, ymax = xyxy.astype(int)
                classidx = int(det.cls.item())
                conf = float(det.conf.item())
                
                if conf >= request.confidence_threshold:
                    detection_data.append({
                        'classe': model.names[classidx],
                        'confiance': conf,
                        'bbox': [int(xmin), int(ymin), int(xmax), int(ymax)],
                        'index': i
                    })
        
        duplicates = analyze_duplicates(detection_data)
        
        if not duplicates:
            return {
                "success": True,
                "detected": False,
                "result": {
                    "label": "",
                    "confidence": 0.0,
                    "processing_time": time.time() - start_time,
                    "annotated_image": "",
                    "bounding_boxes": [],
                    "detections_detailed": detection_data,
                    "classes_detected": []
                },
                "metadata": {
                    "model": MODEL_PATH,
                    "model_classes": list(model.names.values()),
                    "total_detections": len(detection_data),
                    "confidence_threshold": request.confidence_threshold,
                    "image_processed_at_640x640": False
                }
            }
        
        common_symbol = list(duplicates.keys())[0]
        duplicate_detections = [d for d in detection_data if d['classe'] == common_symbol]
        
        bounding_boxes = []
        for det in duplicate_detections:
            bbox_percent = convert_to_percentage(det['bbox'], image_width, image_height)
            bounding_boxes.append({
                "x": bbox_percent['x'],
                "y": bbox_percent['y'],
                "width": bbox_percent['width'],
                "height": bbox_percent['height'],
                "confidence": det['confiance'],
                "label": det['classe']
            })
        
        annotated_image = ""
        if request.draw_boxes:
            annotated_image = draw_bounding_boxes(image, duplicate_detections)
        
        avg_confidence = sum([d['confiance'] for d in duplicate_detections]) / len(duplicate_detections)
        processing_time = time.time() - start_time
        
        return {
            "success": True,
            "detected": True,
            "result": {
                "label": common_symbol,
                "confidence": avg_confidence,
                "processing_time": processing_time,
                "annotated_image": annotated_image,
                "bounding_boxes": bounding_boxes,
                "detections_detailed": detection_data,
                "classes_detected": [common_symbol]
            },
            "metadata": {
                "model": MODEL_PATH,
                "model_classes": list(model.names.values()),
                "total_detections": len(detection_data),
                "confidence_threshold": request.confidence_threshold,
                "image_processed_at_640x640": False,
                "common_symbols_found": len(duplicates)
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@app.post("/api/dino/detect-gesture")
async def detect_gesture(request: DetectGestureRequest):
    """
    Détecte le geste de la main pour contrôler le Dino avec GestureRecognizer
    
    Mapping gestes:
    - "Close" → "jump" (poing fermé)
    - "Open" ou "OK" → "jump" (main ouverte ou OK)
    - "Pointer" → "neutral"
    - Pas de main → "neutral"
    
    Returns: {gesture, confidence, landmarks}
    """
    if recognizer is None:
        raise HTTPException(status_code=500, detail="GestureRecognizer not initialized")
    
    try:
        # Décoder l'image
        image = decode_base64_image(request.image)
        image_height, image_width = image.shape[:2]
        
        # Reconnaissance avec GestureRecognizer
        result = recognizer.recognize(image)
        
        # Si pas de main détectée
        if not result["hand_detected"]:
            return {
                "gesture": "neutral",
                "confidence": 0.0,
                "landmarks": []
            }
        
        # Mapping des gestes du modèle vers les actions du jeu
        gesture_map = {
            "Open": "jump",      # Paume ouverte → sauter
            "Close": "jump",     # Poing fermé → sauter
            "OK": "jump",        # Signe OK → sauter
            "Pointer": "jump"    # Doigt pointeur → sauter
        }
        
        detected_gesture = result["gesture"]
        mapped_gesture = gesture_map.get(detected_gesture, "neutral")
        
        # Convertir landmarks de pixels [[x, y], ...] vers format normalisé [{x, y, z}, ...]
        normalized_landmarks = []
        for landmark_point in result["landmarks"]:
            normalized_landmarks.append({
                "x": landmark_point[0] / image_width,   # Normaliser x
                "y": landmark_point[1] / image_height,  # Normaliser y
                "z": 0.0  # Z non utilisé mais requis par le frontend
            })
        
        print(f"[GESTURE] Detected: {detected_gesture} → {mapped_gesture} (confidence: {result['confidence']:.3f})")
        
        return {
            "gesture": mapped_gesture,
            "confidence": float(result["confidence"]),
            "landmarks": normalized_landmarks
        }
        
    except Exception as e:
        print(f"❌ Gesture detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Gesture detection error: {str(e)}")


@app.get("/api/dino/test-opencv")
async def test_opencv():
    """
    Lance une fenêtre OpenCV pour tester la détection de gestes en temps réel.
    Appuyez sur ESC pour fermer la fenêtre.
    
    Utilise les mêmes paramètres que gesture_recognition_simple.py
    """
    import copy
    from collections import deque, Counter
    import threading
    
    def run_opencv_test():
        # Configuration de la caméra (comme gesture_recognition_simple.py)
        cap = cv.VideoCapture(0)
        cap.set(cv.CAP_PROP_FRAME_WIDTH, 960)
        cap.set(cv.CAP_PROP_FRAME_HEIGHT, 540)
        
        # Historique pour lissage temporel
        gesture_history = deque(maxlen=10)
        CONFIDENCE_THRESHOLD = 0.6
        
        print("=== Test OpenCV - Reconnaissance de Gestes ===")
        print("Gestes reconnus: Open, Close, Pointer, OK")
        print("Appuyez sur ESC pour quitter\n")
        
        while True:
            ret, image = cap.read()
            if not ret:
                print("Erreur: Impossible de lire la caméra")
                break
            
            # Miroir horizontal
            image = cv.flip(image, 1)
            debug_image = copy.deepcopy(image)
            
            # Reconnaissance avec GestureRecognizer
            result = recognizer.recognize(image)
            
            if result["hand_detected"]:
                gesture_name = result["gesture"]
                landmarks = result["landmarks"]
                brect = result["bounding_box"]
                handedness = result["handedness"]
                
                # Lissage temporel
                gesture_history.append(gesture_name)
                if len(gesture_history) >= 5:
                    gesture_count = Counter(gesture_history)
                    smoothed_gesture = gesture_count.most_common(1)[0][0]
                else:
                    smoothed_gesture = gesture_name
                
                # Dessiner les landmarks (comme gesture_recognition_simple.py)
                debug_image = draw_hand_landmarks(debug_image, landmarks)
                
                # Dessiner la bounding box
                if brect:
                    cv.rectangle(debug_image, (brect[0], brect[1]), (brect[2], brect[3]), (0, 255, 0), 2)
                    
                    # Texte au-dessus de la bounding box
                    cv.rectangle(debug_image, (brect[0], brect[1]), (brect[2], brect[1] - 22), (0, 255, 0), -1)
                    info_text = f"{handedness}: {smoothed_gesture}"
                    cv.putText(debug_image, info_text, (brect[0] + 5, brect[1] - 4),
                               cv.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv.LINE_AA)
                
                # Affichage du geste en grand
                cv.putText(debug_image, f"Geste: {smoothed_gesture}", (10, 60),
                           cv.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 6, cv.LINE_AA)
                cv.putText(debug_image, f"Geste: {smoothed_gesture}", (10, 60),
                           cv.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 2, cv.LINE_AA)
                
                # Mapping vers actions du jeu
                gesture_map = {"Open": "JUMP", "Close": "JUMP", "OK": "JUMP", "Pointer": "JUMP"}
                action = gesture_map.get(smoothed_gesture, "NEUTRAL")
                cv.putText(debug_image, f"Action: {action}", (10, 110),
                           cv.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 4, cv.LINE_AA)
                cv.putText(debug_image, f"Action: {action}", (10, 110),
                           cv.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 0), 2, cv.LINE_AA)
            else:
                cv.putText(debug_image, "Aucune main detectee", (10, 60),
                           cv.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv.LINE_AA)
            
            # Affichage
            cv.imshow('Test Gesture Recognition - ESC pour quitter', debug_image)
            
            key = cv.waitKey(10)
            if key == 27:  # ESC
                break
        
        cap.release()
        cv.destroyAllWindows()
    
    def draw_hand_landmarks(image, landmark_points):
        """Dessine les landmarks comme gesture_recognition_simple.py"""
        if len(landmark_points) > 0:
            connections = [
                (2, 3), (3, 4),
                (5, 6), (6, 7), (7, 8),
                (9, 10), (10, 11), (11, 12),
                (13, 14), (14, 15), (15, 16),
                (17, 18), (18, 19), (19, 20),
                (0, 1), (1, 2), (2, 5), (5, 9), (9, 13), (13, 17), (17, 0)
            ]
            
            for connection in connections:
                cv.line(image, tuple(landmark_points[connection[0]]),
                       tuple(landmark_points[connection[1]]), (0, 0, 0), 6)
                cv.line(image, tuple(landmark_points[connection[0]]),
                       tuple(landmark_points[connection[1]]), (255, 255, 255), 2)
            
            for index, landmark in enumerate(landmark_points):
                if index in [0, 1, 2, 5, 9, 13, 17]:
                    cv.circle(image, (landmark[0], landmark[1]), 5, (255, 255, 255), -1)
                    cv.circle(image, (landmark[0], landmark[1]), 5, (0, 0, 0), 1)
                if index in [4, 8, 12, 16, 20]:
                    cv.circle(image, (landmark[0], landmark[1]), 8, (255, 255, 255), -1)
                    cv.circle(image, (landmark[0], landmark[1]), 8, (0, 0, 0), 1)
        
        return image
    
    # Lancer dans un thread séparé pour ne pas bloquer le serveur
    thread = threading.Thread(target=run_opencv_test)
    thread.start()
    
    return {
        "status": "started",
        "message": "Fenêtre OpenCV lancée. Appuyez sur ESC pour fermer.",
        "instructions": [
            "✋ Main ouverte (Open) → JUMP",
            "✊ Poing fermé (Close) → JUMP", 
            "👌 Signe OK → JUMP",
            "☝️ Doigt pointé (Pointer) → NEUTRAL"
        ]
    }


# =============================================================================
# WebSocket pour streaming temps réel
# =============================================================================

@app.websocket("/ws/gesture")
async def websocket_gesture(websocket: WebSocket):
    """
    WebSocket endpoint pour la détection de gestes en temps réel.
    
    Le client envoie des images en base64, le serveur renvoie les résultats
    immédiatement sans overhead HTTP.
    
    Message entrant (JSON):
        {"image": "data:image/jpeg;base64,..."}
    
    Message sortant (JSON):
        {
            "gesture": "jump|duck|neutral",
            "raw_gesture": "Open|Close|OK|Pointer",
            "confidence": 0.95,
            "landmarks": [{x, y, z}, ...]
        }
    """
    await websocket.accept()
    print("🔌 WebSocket client connecté")
    
    try:
        while True:
            # Recevoir l'image du client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if "image" not in message:
                await websocket.send_json({"error": "No image provided"})
                continue
            
            try:
                # Décoder l'image base64
                image_data = message["image"]
                if "base64," in image_data:
                    image_data = image_data.split("base64,")[1]
                
                image_bytes = base64.b64decode(image_data)
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv.imdecode(nparr, cv.IMREAD_COLOR)
                
                if image is None:
                    await websocket.send_json({"error": "Invalid image"})
                    continue
                
                # Dimensions pour normalisation
                image_height, image_width = image.shape[:2]
                
                # Détection de geste
                result = recognizer.recognize(image)
                
                # Normaliser les landmarks
                normalized_landmarks = []
                if result["landmarks"] is not None and len(result["landmarks"]) > 0:
                    for landmark_point in result["landmarks"]:
                        normalized_landmarks.append({
                            "x": landmark_point[0] / image_width,
                            "y": landmark_point[1] / image_height,
                            "z": 0.0
                        })
                
                # Mapper le geste
                raw_gesture = result["gesture"] if result["gesture"] else "neutral"
                gesture_map = {
                    "Open": "jump",      # Paume ouverte = sauter
                    "Close": "jump",     # Poing fermé = sauter
                    "OK": "jump",        # Signe OK = sauter
                    "Pointer": "jump"    # Doigt pointeur = sauter
                }
                mapped_gesture = gesture_map.get(raw_gesture, "neutral")
                
                # Envoyer le résultat
                await websocket.send_json({
                    "gesture": mapped_gesture,
                    "raw_gesture": raw_gesture,
                    "confidence": result["confidence"],
                    "landmarks": normalized_landmarks
                })
                
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                
    except WebSocketDisconnect:
        print("🔌 WebSocket client déconnecté")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend API operational"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)