from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional, List
import base64
import io
import os
import time
import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO
import mediapipe as mp
from collections import Counter

# Imports pour GestureRecognizer
try:
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    MEDIAPIPE_TASKS_AVAILABLE = True
except ImportError:
    MEDIAPIPE_TASKS_AVAILABLE = False
    print("⚠️  mediapipe.tasks not available, will use fallback")

# Couleurs pour les bounding boxes (comme dans le Streamlit)
BBOX_COLORS = [(164,120,87), (68,148,228), (93,97,209), (178,182,133), (88,159,106), 
               (96,202,231), (159,124,168), (169,162,241), (98,118,150), (172,176,184)]

# Chargement des modèles au démarrage
CHARLIE_MODEL_PATH = "yolo11.pt"
if not os.path.exists(CHARLIE_MODEL_PATH):
    CHARLIE_MODEL_PATH = os.environ.get("YOLO11_WEIGHTS", "yolo11.pt")

DOBBLE_MODEL_PATH = "dobble.pt"
if not os.path.exists(DOBBLE_MODEL_PATH):
    DOBBLE_MODEL_PATH = os.environ.get("DOBBLE_WEIGHTS", "dobble.pt")

print(f"🔄 Chargement des modèles YOLO...")

# Charger le modèle Charlie
try:
    charlie_model = YOLO(CHARLIE_MODEL_PATH, task='detect')
    print(f"✅ Modèle Charlie (yolo11.pt) chargé avec succès")
    print(f"   Classes: {list(charlie_model.names.values())}")
except Exception as e:
    print(f"❌ Erreur lors du chargement de Charlie: {e}")
    charlie_model = None

# Charger le modèle Dobble
try:
    dobble_model = YOLO(DOBBLE_MODEL_PATH, task='detect')
    print(f"✅ Modèle Dobble (dobble.pt) chargé avec succès")
    print(f"   Classes: {list(dobble_model.names.values())}")
except Exception as e:
    print(f"❌ Erreur lors du chargement de Dobble: {e}")
    dobble_model = None

# Pour compatibilité avec le code existant
model = charlie_model

app = FastAPI(
    title="YOLO Charlie Detection Backend",
    version="1.0.0",
    description="Backend FastAPI basé sur le code Streamlit qui fonctionne"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CharlieAnalyzeRequest(BaseModel):
    image: str  # data URL
    confidence_threshold: Optional[float] = 0.5
    draw_boxes: Optional[bool] = True

class DetectionResult(BaseModel):
    classe: str
    confiance: float
    bbox: List[int]  # [xmin, ymin, xmax, ymax] en pixels absolus
    bbox_percent: Dict[str, float]  # {x, y, width, height} en pourcentage

def data_url_to_opencv_image(data_url: str) -> np.ndarray:
    """Convertit une data URL en image OpenCV BGR (comme dans Streamlit)"""
    if not data_url.startswith("data:image/"):
        raise ValueError("Data URL invalide")
    
    header, b64data = data_url.split(",", 1)
    binary = base64.b64decode(b64data)
    
    # PIL -> numpy RGB -> OpenCV BGR (exactement comme Streamlit)
    pil_image = Image.open(io.BytesIO(binary))
    rgb_array = np.array(pil_image.convert("RGB"))
    bgr_image = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    
    return bgr_image

def opencv_image_to_data_url(image: np.ndarray) -> str:
    """Convertit une image OpenCV BGR en data URL"""
    # BGR -> RGB pour l'encodage
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb_image)
    
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG", quality=90)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/jpeg;base64,{img_str}"

def process_image_with_yolo(image: np.ndarray, model_to_use: YOLO, confidence_threshold: float, draw_boxes: bool = True):
    """
    Traite une image avec YOLO - logique adaptée du Streamlit qui fonctionne
    """
    start_time = time.time()
    
    # Sauvegarder les dimensions originales
    original_shape = image.shape[:2]  # (height, width)
    
    # Redimensionner à 640x640 pour l'inférence (comme dans Streamlit)
    image_resized = cv2.resize(image, (640, 640))
    
    # Inférence YOLO
    results = model_to_use(image_resized, verbose=False)
    detections = results[0].boxes if results and len(results) > 0 else None
    
    processing_time = time.time() - start_time
    
    # Préparer les résultats
    detection_data = []
    image_with_boxes = image.copy() if draw_boxes else image
    
    if detections is not None and len(detections) > 0:
        # Facteurs d'échelle pour remettre les coordonnées à l'image originale
        scale_x = original_shape[1] / 640  # width scaling
        scale_y = original_shape[0] / 640  # height scaling
        
        for i in range(len(detections)):
            # Extraire les coordonnées (comme dans Streamlit)
            xyxy_tensor = detections[i].xyxy.cpu()
            xyxy = xyxy_tensor.numpy().squeeze()
            
            # Adapter les coordonnées à l'image originale
            xmin, ymin, xmax, ymax = xyxy.astype(int)
            xmin = int(xmin * scale_x)
            ymin = int(ymin * scale_y)
            xmax = int(xmax * scale_x)
            ymax = int(ymax * scale_y)
            
            # Extraire classe et confiance
            classidx = int(detections[i].cls.item())
            classname = model_to_use.names[classidx]
            conf = detections[i].conf.item()
            
            # Filtrer par seuil de confiance
            if conf >= confidence_threshold:
                # Calculer bbox en pourcentage (pour l'API)
                bbox_percent = {
                    "x": (xmin / original_shape[1]) * 100.0,
                    "y": (ymin / original_shape[0]) * 100.0,
                    "width": ((xmax - xmin) / original_shape[1]) * 100.0,
                    "height": ((ymax - ymin) / original_shape[0]) * 100.0,
                }
                
                # Ajouter aux résultats
                detection_data.append({
                    "classe": classname,
                    "confiance": conf,
                    "bbox": [xmin, ymin, xmax, ymax],
                    "bbox_percent": bbox_percent
                })
                
                # Dessiner les bounding boxes (logique exacte du Streamlit)
                if draw_boxes:
                    color = BBOX_COLORS[classidx % len(BBOX_COLORS)]
                    
                    # Rectangle de détection
                    cv2.rectangle(image_with_boxes, (xmin, ymin), (xmax, ymax), color, 2)
                    
                    # Label avec confiance
                    label = f'{classname}: {int(conf*100)}%'
                    labelSize, baseLine = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    label_ymin = max(ymin, labelSize[1] + 10)
                    
                    # Fond du label
                    cv2.rectangle(image_with_boxes, (xmin, label_ymin-labelSize[1]-10), 
                                (xmin+labelSize[0], label_ymin+baseLine-10), color, cv2.FILLED)
                    
                    # Texte du label
                    cv2.putText(image_with_boxes, label, (xmin, label_ymin-7), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    
    return image_with_boxes, detection_data, processing_time

@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    charlie_status = "loaded" if charlie_model is not None else "error"
    dobble_status = "loaded" if dobble_model is not None else "error"
    
    charlie_info = {
        "path": CHARLIE_MODEL_PATH,
        "exists": os.path.exists(CHARLIE_MODEL_PATH),
        "classes": list(charlie_model.names.values()) if charlie_model else [],
        "num_classes": len(charlie_model.names) if charlie_model else 0
    }
    
    dobble_info = {
        "path": DOBBLE_MODEL_PATH,
        "exists": os.path.exists(DOBBLE_MODEL_PATH),
        "classes": list(dobble_model.names.values()) if dobble_model else [],
        "num_classes": len(dobble_model.names) if dobble_model else 0
    }
    
    return {
        "status": "ok",
        "message": "Backend YOLO prêt avec Charlie et Dobble",
        "models": {
            "charlie": {
                "status": charlie_status,
                "info": charlie_info,
                "type": "YOLO11"
            },
            "dobble": {
                "status": dobble_status,
                "info": dobble_info,
                "type": "YOLO (Custom)"
            }
        }
    }

@app.post("/api/analyze/charlie")
async def analyze_charlie(req: CharlieAnalyzeRequest) -> Dict[str, Any]:
    """Analyse une image pour détecter Charlie avec YOLO11"""
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Image data URL manquante ou invalide")
    
    if charlie_model is None:
        raise HTTPException(status_code=500, detail="Modèle Charlie YOLO non chargé")

    try:
        # Convertir data URL en image OpenCV
        image_bgr = data_url_to_opencv_image(req.image)
        
        # Traitement avec YOLO
        image_with_detections, detection_data, processing_time = process_image_with_yolo(
            image_bgr, 
            charlie_model,
            req.confidence_threshold or 0.5,
            req.draw_boxes if req.draw_boxes is not None else True
        )
        
        # Convertir l'image résultat en data URL si des boxes ont été dessinées
        annotated_image = req.image  # Image originale par défaut
        if req.draw_boxes and detection_data:
            annotated_image = opencv_image_to_data_url(image_with_detections)
        
        # Statistiques
        best_confidence = max([d["confiance"] for d in detection_data], default=0.0)
        classes_detected = list(set([d["classe"] for d in detection_data]))
        
        return {
            "success": True,
            "detected": len(detection_data) > 0,
            "result": {
                "label": f"YOLO11 - {len(detection_data)} détection(s)",
                "confidence": best_confidence,
                "processing_time": processing_time,
                "annotated_image": annotated_image,
                "bounding_boxes": [
                    {
                        "x": d["bbox_percent"]["x"],
                        "y": d["bbox_percent"]["y"], 
                        "width": d["bbox_percent"]["width"],
                        "height": d["bbox_percent"]["height"],
                        "confidence": d["confiance"],
                        "label": d["classe"]
                    }
                    for d in detection_data
                ],
                "detections_detailed": detection_data,
                "classes_detected": classes_detected
            },
            "metadata": {
                "model": "YOLO11",
                "model_classes": list(charlie_model.names.values()) if charlie_model else [],
                "total_detections": len(detection_data),
                "confidence_threshold": req.confidence_threshold or 0.5,
                "image_processed_at_640x640": True
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse Charlie: {str(e)}")

@app.post("/api/analyze/dobble")
async def analyze_dobble(req: CharlieAnalyzeRequest) -> Dict[str, Any]:
    """Analyse une image pour détecter les symboles Dobble"""
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Image data URL manquante ou invalide")
    
    if dobble_model is None:
        raise HTTPException(status_code=500, detail="Modèle Dobble YOLO non chargé")

    try:
        # Convertir data URL en image OpenCV
        image_bgr = data_url_to_opencv_image(req.image)
        
        # Traitement avec YOLO Dobble
        image_with_detections, detection_data, processing_time = process_image_with_yolo(
            image_bgr, 
            dobble_model,
            req.confidence_threshold or 0.3,
            req.draw_boxes if req.draw_boxes is not None else True
        )
        
        # Convertir l'image résultat en data URL si des boxes ont été dessinées
        annotated_image = req.image  # Image originale par défaut
        if req.draw_boxes and detection_data:
            annotated_image = opencv_image_to_data_url(image_with_detections)
        
        # Statistiques
        best_confidence = max([d["confiance"] for d in detection_data], default=0.0)
        classes_detected = list(set([d["classe"] for d in detection_data]))
        
        return {
            "success": True,
            "detected": len(detection_data) > 0,
            "result": {
                "label": f"Dobble - {len(detection_data)} symbole(s)",
                "confidence": best_confidence,
                "processing_time": processing_time,
                "annotated_image": annotated_image,
                "bounding_boxes": [
                    {
                        "x": d["bbox_percent"]["x"],
                        "y": d["bbox_percent"]["y"], 
                        "width": d["bbox_percent"]["width"],
                        "height": d["bbox_percent"]["height"],
                        "confidence": d["confiance"],
                        "label": d["classe"]
                    }
                    for d in detection_data
                ],
                "detections_detailed": detection_data,
                "classes_detected": classes_detected
            },
            "metadata": {
                "model": "Dobble",
                "model_classes": list(dobble_model.names.values()) if dobble_model else [],
                "total_detections": len(detection_data),
                "confidence_threshold": req.confidence_threshold or 0.3,
                "image_processed_at_640x640": True
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse Dobble: {str(e)}")

# ============================================================================
# MediaPipe GestureRecognizer pour détection de gestes (Dino Run)
# ============================================================================
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import os

# Télécharger le modèle si nécessaire
GESTURE_MODEL_PATH = "gesture_recognizer.task"
if not os.path.exists(GESTURE_MODEL_PATH):
    print(f"⚠️  Modèle {GESTURE_MODEL_PATH} introuvable. Utilisation de Hands pour fallback.")
    GESTURE_MODEL_PATH = None
    mp_hands = mp.solutions.hands
    hands_detector = mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5
    )
    USE_GESTURE_RECOGNIZER = False
else:
    print(f"✅ Modèle GestureRecognizer trouvé: {GESTURE_MODEL_PATH}")
    base_options = python.BaseOptions(model_asset_path=GESTURE_MODEL_PATH)
    options = vision.GestureRecognizerOptions(base_options=base_options)
    gesture_recognizer = vision.GestureRecognizer.create_from_options(options)
    USE_GESTURE_RECOGNIZER = True

def base64_to_opencv_image(base64_string: str) -> np.ndarray:
    """Convertit une chaîne base64 en image OpenCV BGR"""
    try:
        binary = base64.b64decode(base64_string)
        pil_image = Image.open(io.BytesIO(binary))
        rgb_array = np.array(pil_image.convert("RGB"))
        bgr_image = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        return bgr_image
    except Exception as e:
        raise ValueError(f"Erreur décodage base64: {str(e)}")

def detect_hand_gesture(image: np.ndarray) -> Dict[str, Any]:
    """
    Détecte si la main est fermée (poing) ou ouverte.
    Retourne: {gesture: 'jump'|'duck'|'none', confidence: float, landmarks: [...]}
    
    - jump = Open_Palm (main ouverte)
    - duck = Closed_Fist (poing fermé)
    - none = geste non reconnu ou pas de main
    """
    try:
        # Convertir BGR -> RGB pour MediaPipe
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = rgb_image.shape[:2]
        
        if USE_GESTURE_RECOGNIZER:
            # Utiliser le modèle GestureRecognizer officiel
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
            recognition_result = gesture_recognizer.recognize(mp_image)
            
            # Extraire les landmarks aussi
            landmarks = []
            if recognition_result.hand_landmarks and len(recognition_result.hand_landmarks) > 0:
                hand_landmarks = recognition_result.hand_landmarks[0]
                for landmark in hand_landmarks:
                    landmarks.append({
                        "x": float(landmark.x),
                        "y": float(landmark.y),
                        "z": float(landmark.z) if landmark.z else 0.0
                    })
            
            if not recognition_result.gestures or len(recognition_result.gestures) == 0:
                return {"gesture": "none", "confidence": 0.0, "landmarks": landmarks}
            
            # Prendre le geste le plus confiant
            gestures = recognition_result.gestures[0]  # Première main
            if not gestures:
                return {"gesture": "none", "confidence": 0.0, "landmarks": landmarks}
            
            top_gesture = gestures[0]
            gesture_name = top_gesture.category_name
            confidence = top_gesture.score
            
            # Log tous les gestes détectés
            all_gestures_str = ", ".join([f"{g.category_name}({g.score:.2f})" for g in gestures[:3]])
            print(f"[GESTURE] All detected: {all_gestures_str}")
            
            # Mapper les gestes MediaPipe à nos actions
            # Open_Palm = main ouverte (JUMP)
            # Closed_Fist = poing fermé (DUCK)
            # Thumb_Up, Pointing_Up, Victory = gestes alternatifs pour JUMP
            # Peace = doigts en V
            
            if gesture_name == "Open_Palm":
                print(f"✅ JUMP detected (Open_Palm, conf: {confidence:.3f})")
                return {"gesture": "jump", "confidence": float(confidence), "landmarks": landmarks}
            elif gesture_name == "Thumb_Up":
                # Pouce levé = JUMP aussi
                print(f"✅ JUMP detected (Thumb_Up, conf: {confidence:.3f})")
                return {"gesture": "jump", "confidence": float(confidence), "landmarks": landmarks}
            elif gesture_name == "Victory":
                # Doigts en V = JUMP
                print(f"✅ JUMP detected (Victory, conf: {confidence:.3f})")
                return {"gesture": "jump", "confidence": float(confidence), "landmarks": landmarks}
            elif gesture_name == "Pointing_Up":
                # Doigt pointé vers le haut = JUMP
                print(f"✅ JUMP detected (Pointing_Up, conf: {confidence:.3f})")
                return {"gesture": "jump", "confidence": float(confidence), "landmarks": landmarks}
            elif gesture_name == "Closed_Fist":
                print(f"✅ DUCK detected (Closed_Fist, conf: {confidence:.3f})")
                return {"gesture": "duck", "confidence": float(confidence), "landmarks": landmarks}
            elif gesture_name == "ILoveYou":
                # Geste "I Love You" (doigt levé + auriculaire) = DUCK (abaissement)
                print(f"✅ DUCK detected (ILoveYou, conf: {confidence:.3f})")
                return {"gesture": "duck", "confidence": float(confidence), "landmarks": landmarks}
            else:
                print(f"⚠️  UNKNOWN gesture: {gesture_name}")
                return {"gesture": "none", "confidence": 0.0, "landmarks": landmarks}
        
        else:
            # Fallback: Utiliser Hands pour détection basique
            results = hands_detector.process(rgb_image)
            
            # Extraire les landmarks
            landmarks = []
            if results.multi_hand_landmarks and len(results.multi_hand_landmarks) > 0:
                hand_landmarks = results.multi_hand_landmarks[0]
                for landmark in hand_landmarks.landmark:
                    landmarks.append({
                        "x": float(landmark.x),
                        "y": float(landmark.y),
                        "z": float(landmark.z)
                    })
            
            if not results.multi_hand_landmarks or len(results.multi_hand_landmarks) == 0:
                return {"gesture": "none", "confidence": 0.0, "landmarks": landmarks}
            
            # Prendre la première main détectée
            hand_landmarks = results.multi_hand_landmarks[0]
            
            # Landmarks clés (indices MediaPipe):
            # 0 = wrist (poignet)
            # 4 = thumb tip, 8 = index tip, 12 = middle tip, 16 = ring tip, 20 = pinky tip
            
            wrist = hand_landmarks.landmark[0]  # Poignet
            
            # Points de bout des doigts (tips)
            finger_tips = [
                hand_landmarks.landmark[4],   # thumb tip
                hand_landmarks.landmark[8],   # index tip
                hand_landmarks.landmark[12],  # middle tip
                hand_landmarks.landmark[16],  # ring tip
                hand_landmarks.landmark[20],  # pinky tip
            ]
            
            # Calculer distance moyenne entre poignet et bouts des doigts
            distances = []
            for i, tip in enumerate(finger_tips):
                if tip.visibility > 0.3:
                    # Distance en pixels
                    dist_x = (tip.x - wrist.x) * w
                    dist_y = (tip.y - wrist.y) * h
                    dist = np.sqrt(dist_x**2 + dist_y**2)
                    distances.append(dist)
            
            if len(distances) == 0:
                return {"gesture": "none", "confidence": 0.0, "landmarks": landmarks}
            
            avg_distance = np.mean(distances)
            
            # DEBUG: Log les distances pour calibrage
            print(f"[GESTURE-FALLBACK] avg_distance: {avg_distance:.2f}px, distances: {[f'{d:.1f}' for d in distances]}")
            
            # Seuils de détection:
            if avg_distance > 60:
                # Main ouverte -> JUMP
                confidence = min(1.0, (avg_distance - 60) / 80)
                print(f"✅ JUMP detected (distance: {avg_distance:.2f})")
                return {"gesture": "jump", "confidence": float(confidence), "landmarks": landmarks}
            elif avg_distance < 30:
                # Poing fermé -> DUCK
                confidence = 1.0 - (avg_distance / 35)
                print(f"✅ DUCK detected (distance: {avg_distance:.2f})")
                return {"gesture": "duck", "confidence": float(confidence), "landmarks": landmarks}
            else:
                # Ambigü ou transition
                print(f"⚠️  AMBIGUOUS (distance: {avg_distance:.2f})")
                return {"gesture": "none", "confidence": 0.5, "landmarks": landmarks}
            
    except Exception as e:
        print(f"[ERROR] Gesture detection: {e}")
        import traceback
        traceback.print_exc()
        return {"gesture": "none", "confidence": 0.0}

class DinoGestureRequest(BaseModel):
    image: str  # base64 string (sans le préfixe data:image/jpeg;base64,)

@app.post("/api/dino/detect-gesture")
async def detect_gesture(req: DinoGestureRequest) -> Dict[str, Any]:
    """Détecte le geste de la main (jump/duck) pour le jeu Dino"""
    if not req.image:
        raise HTTPException(status_code=400, detail="Image base64 manquante")
    
    try:
        # Convertir base64 en image OpenCV
        image_bgr = base64_to_opencv_image(req.image)
        
        # Détection du geste
        gesture_result = detect_hand_gesture(image_bgr)
        
        return {
            "success": True,
            **gesture_result
        }
        
    except Exception as e:
        return {
            "success": False,
            "gesture": "none",
            "confidence": 0.0,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")