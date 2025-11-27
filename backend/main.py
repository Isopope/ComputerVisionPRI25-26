from fastapi import FastAPI, HTTPException
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
import cv2
from ultralytics import YOLO
from collections import Counter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "dobble.pt"
model = None

@app.on_event("startup")
async def load_yolo_model():
    global model
    try:
        if os.path.exists(MODEL_PATH):
            model = YOLO(MODEL_PATH, task='detect')
            print(f"Model loaded: {MODEL_PATH}")
    except Exception as e:
        print(f"Error loading model: {e}")
        model = None

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
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        return image_np
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

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
        
        cv2.rectangle(image_copy, (xmin, ymin), (xmax, ymax), (0, 0, 255), 4)
        
        cx = (xmin + xmax) // 2
        cy = (ymin + ymax) // 2
        cv2.circle(image_copy, (cx, cy), 12, (0, 0, 255), -1)
        cv2.circle(image_copy, (cx, cy), 15, (255, 255, 255), 2)
        
        label_text = f'{label} ({int(conf*100)}%)'
        cv2.putText(image_copy, label_text, (xmin, ymin-15),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    
    image_rgb = cv2.cvtColor(image_copy, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(image_rgb)
    buffer = io.BytesIO()
    pil_image.save(buffer, format="JPEG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/jpeg;base64,{img_str}"

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "message": "Backend YOLO Dobble operational",
        "model": {
            "status": "loaded" if model else "not_loaded",
            "info": {
                "path": MODEL_PATH,
                "exists": os.path.exists(MODEL_PATH),
                "classes": list(model.names.values()) if model else [],
                "num_classes": len(model.names) if model else 0
            },
            "type": "YOLO Dobble Detection"
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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Dobble Detection API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)