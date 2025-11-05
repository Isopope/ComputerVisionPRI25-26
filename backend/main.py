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
    description="MVP minimal: Où est Charlie (ai-pure, ia-vs-humain)"
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
    mode: str = "ai-pure"  # "ai-pure" | "ai-vs-human"
    submode: str = "capture"  # MVP: capture uniquement
    analyzer: str = "yolo11"  # "yolo11" | "placeholder"
    confidence_threshold: Optional[float] = 0.25
    target_label: Optional[str] = None


@app.post("/api/analyze/charlie")
async def analyze_charlie(req: CharlieAnalyzeRequest) -> Dict[str, Any]:
    if not req.image or not req.image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Image data URL manquante ou invalide")

    start = time.time()
    if req.analyzer == "placeholder":
        result = {
            "detected": True,
            "bounding_boxes": [
                {"x": 40.0, "y": 30.0, "width": 10.0, "height": 15.0, "confidence": 0.99}
            ],
            "confidence": 0.99,
            "metadata": {"note": "placeholder"},
        }
    else:
        # Import différé pour éviter la dépendance si non utilisée
        try:
            from analyzers.utils import data_url_to_bgr  # type: ignore
            from analyzers.yolo11 import Yolo11Analyzer  # type: ignore
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur import analyzers: {e}")

        try:
            weights = os.environ.get("YOLO11_WEIGHTS", "yolo11.pt")
            analyzer = Yolo11Analyzer(
                weights_path=weights,
                confidence_threshold=req.confidence_threshold or 0.25,
                target_label=req.target_label,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur initialisation YOLO11: {e}")

        try:
            bgr = data_url_to_bgr(req.image)
            result = analyzer.analyze(bgr)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur d'analyse YOLO11: {e}")

    duration = time.time() - start
    return {
        "success": True,
        "detected": bool(result.get("detected")),
        "result": {
            "label": "Charlie (YOLO11)" if req.analyzer != "placeholder" else "Charlie (placeholder)",
            "confidence": float(result.get("confidence", 0.0)),
            "processing_time": duration,
            "annotated_image": req.image,
            "bounding_boxes": result.get("bounding_boxes", []),
        },
        "metadata": result.get("metadata", {}),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
