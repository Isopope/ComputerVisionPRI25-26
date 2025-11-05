from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, Optional
import base64
import io
import os
import time
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO

# Initialisation du modèle YOLO11 au démarrage
MODEL_PATH = "yolo11.pt"
if not Path(MODEL_PATH).exists():
    MODEL_PATH = os.environ.get("YOLO11_WEIGHTS", "yolo11.pt")

print(f"Chargement du modèle YOLO11 depuis: {MODEL_PATH}")
try:
    model = YOLO(MODEL_PATH)
    print("✓ Modèle YOLO11 chargé avec succès")
except Exception as e:
    print(f"✗ Erreur lors du chargement du modèle: {e}")
    model = None

app = FastAPI(
    title="Game AI Backend (MVP Charlie)",
    version="0.1.0",
    description="MVP minimal: Où est Charlie avec YOLO11"
)

# CORS minimal pour dev local
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    model_status = "loaded" if model is not None else "error"
    model_info = str(Path(MODEL_PATH).resolve()) if Path(MODEL_PATH).exists() else "not found"
    
    return {
        "status": "ok",
        "message": "Backend is running",
        "model": {
            "status": model_status,
            "path": model_info,
            "type": "YOLO11"
        },
        "mvp": {
            "game": "charlie",
            "modes": ["ai-pure", "ai-vs-human"],
        },
    }


class CharlieAnalyzeRequest(BaseModel):
    image: str  # data URL
    confidence_threshold: Optional[float] = 0.25


def data_url_to_image(data_url: str) -> np.ndarray:
    """Convertit une data URL en image numpy RGB."""
    if not data_url.startswith("data:image/"):
        raise ValueError("Data URL invalide")
    
    header, b64data = data_url.split(",", 1)
    binary = base64.b64decode(b64data)
    img = Image.open(io.BytesIO(binary)).convert("RGB")
    return np.array(img)


@app.post("/api/analyze/charlie")
async def analyze_charlie(req: CharlieAnalyzeRequest) -> Dict[str, Any]:
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Image data URL manquante ou invalide")
    
    if model is None:
        raise HTTPException(status_code=500, detail="Modèle YOLO11 non chargé")

    start = time.time()
    
    try:
        # Convertir data URL en image
        image_rgb = data_url_to_image(req.image)
        
        # Analyser avec YOLO11
        results = model.predict(
            source=image_rgb,
            conf=req.confidence_threshold or 0.25,
            verbose=False
        )
        
        # Extraire les détections
        detections = []
        best_confidence = 0.0
        
        for r in results:
            if r.boxes is not None:
                for box in r.boxes:
                    # Coordonnées xyxy
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0].item())
                    cls_id = int(box.cls[0].item())
                    
                    # Obtenir le nom de la classe
                    class_name = r.names.get(cls_id, f"class_{cls_id}") if hasattr(r, 'names') else f"class_{cls_id}"
                    
                    # Convertir en pourcentages
                    h, w = image_rgb.shape[:2]
                    detection = {
                        "x": (x1 / w) * 100.0,
                        "y": (y1 / h) * 100.0,
                        "width": ((x2 - x1) / w) * 100.0,
                        "height": ((y2 - y1) / h) * 100.0,
                        "confidence": conf,
                        "label": class_name
                    }
                    detections.append(detection)
                    best_confidence = max(best_confidence, conf)
        
        duration = time.time() - start
        
        return {
            "success": True,
            "detected": len(detections) > 0,
            "result": {
                "label": f"YOLO11 - {len(detections)} détection(s)",
                "confidence": best_confidence,
                "processing_time": duration,
                "annotated_image": req.image,  # On pourrait dessiner les bboxes ici
                "bounding_boxes": detections,
            },
            "metadata": {
                "model": "YOLO11",
                "total_detections": len(detections),
            },
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")