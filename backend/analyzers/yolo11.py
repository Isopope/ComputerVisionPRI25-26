from typing import Any, Dict, List

import numpy as np

from .base import Analyzer

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - optional dependency
    YOLO = None  # type: ignore


class Yolo11Analyzer(Analyzer):
    def __init__(self, weights_path: str, confidence_threshold: float = 0.25, target_label: str | None = None):
        if YOLO is None:
            raise RuntimeError("ultralytics (YOLO) n'est pas installé. Ajoutez 'ultralytics' dans requirements.")
        self.model = YOLO(weights_path)
        self.conf = confidence_threshold
        self.target = target_label

    def analyze(self, image_bgr: np.ndarray) -> Dict[str, Any]:
        h, w = image_bgr.shape[:2]
        # ultralytics attend RGB
        rgb = image_bgr[:, :, ::-1]
        results = self.model.predict(source=rgb, conf=self.conf, verbose=False)

        boxes: List[Dict[str, float]] = []
        best_conf = 0.0
        for r in results:
            if r.boxes is None:
                continue
            for b in r.boxes:
                # xyxy format
                x1, y1, x2, y2 = b.xyxy[0].tolist()
                conf = float(b.conf[0].item()) if hasattr(b, "conf") else 0.0
                cls_id = int(b.cls[0].item()) if hasattr(b, "cls") else -1
                label = r.names.get(cls_id, str(cls_id)) if hasattr(r, "names") else str(cls_id)
                if self.target and label != self.target:
                    continue
                boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "confidence": conf, "label": label})
                best_conf = max(best_conf, conf)

        # Convertir en %
        bb_percent = []
        for b in boxes:
            bb_percent.append({
                "x": (b["x1"] / w) * 100.0,
                "y": (b["y1"] / h) * 100.0,
                "width": ((b["x2"] - b["x1"]) / w) * 100.0,
                "height": ((b["y2"] - b["y1"]) / h) * 100.0,
                "confidence": float(b["confidence"]),
                "label": b.get("label", "")
            })

        return {
            "detected": len(bb_percent) > 0,
            "bounding_boxes": bb_percent,
            "confidence": float(best_conf),
            "metadata": {
                "model": "yolo11",
                "num_boxes": len(bb_percent),
                "target": self.target,
            },
        }
