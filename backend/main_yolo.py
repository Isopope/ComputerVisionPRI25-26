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

# Couleurs pour les bounding boxes (comme dans le Streamlit)
BBOX_COLORS = [(164,120,87), (68,148,228), (93,97,209), (178,182,133), (88,159,106), 
               (96,202,231), (159,124,168), (169,162,241), (98,118,150), (172,176,184)]

# Chargement du modèle au démarrage (exactement comme dans Streamlit)
MODEL_PATH = "yolo11.pt"
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.environ.get("YOLO11_WEIGHTS", "yolo11.pt")

print(f"🔄 Chargement du modèle YOLO depuis: {MODEL_PATH}")
try:
    model = YOLO(MODEL_PATH, task='detect')
    print("✅ Modèle YOLO chargé avec succès")
    print(f"📋 Classes disponibles: {list(model.names.values())}")
except Exception as e:
    print(f"❌ Erreur lors du chargement du modèle: {e}")
    model = None

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

def process_image_with_yolo(image: np.ndarray, confidence_threshold: float, draw_boxes: bool = True):
    """
    Traite une image avec YOLO - logique adaptée du Streamlit qui fonctionne
    """
    start_time = time.time()
    
    # Sauvegarder les dimensions originales
    original_shape = image.shape[:2]  # (height, width)
    
    # Redimensionner à 640x640 pour l'inférence (comme dans Streamlit)
    image_resized = cv2.resize(image, (640, 640))
    
    # Inférence YOLO
    results = model(image_resized, verbose=False)
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
            classname = model.names[classidx]
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
    model_status = "loaded" if model is not None else "error"
    model_info = {
        "path": MODEL_PATH,
        "exists": os.path.exists(MODEL_PATH),
        "classes": list(model.names.values()) if model else [],
        "num_classes": len(model.names) if model else 0
    }
    
    return {
        "status": "ok",
        "message": "Backend YOLO prêt",
        "model": {
            "status": model_status,
            "info": model_info,
            "type": "YOLO11"
        }
    }

@app.post("/api/analyze/charlie")
async def analyze_charlie(req: CharlieAnalyzeRequest) -> Dict[str, Any]:
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Image data URL manquante ou invalide")
    
    if model is None:
        raise HTTPException(status_code=500, detail="Modèle YOLO non chargé")

    try:
        # Convertir data URL en image OpenCV (comme dans Streamlit)
        image_bgr = data_url_to_opencv_image(req.image)
        
        # Traitement avec YOLO (logique exacte du Streamlit)
        image_with_detections, detection_data, processing_time = process_image_with_yolo(
            image_bgr, 
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
                "model_classes": list(model.names.values()),
                "total_detections": len(detection_data),
                "confidence_threshold": req.confidence_threshold or 0.5,
                "image_processed_at_640x640": True
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")