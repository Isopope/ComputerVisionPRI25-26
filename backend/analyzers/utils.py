import base64
import io
from typing import Dict

import numpy as np
from PIL import Image


def data_url_to_bgr(data_url: str):
    assert data_url.startswith("data:image/")
    header, b64data = data_url.split(",", 1)
    binary = base64.b64decode(b64data)
    img = Image.open(io.BytesIO(binary)).convert("RGB")
    # PIL -> numpy RGB -> BGR
    arr = np.array(img)
    bgr = arr[:, :, ::-1]
    return bgr


def abs_box_to_percent(box: Dict[str, float], width: int, height: int) -> Dict[str, float]:
    x = (box["x1"] / width) * 100.0
    y = (box["y1"] / height) * 100.0
    w = ((box["x2"] - box["x1"]) / width) * 100.0
    h = ((box["y2"] - box["y1"]) / height) * 100.0
    return {"x": x, "y": y, "width": w, "height": h, "confidence": float(box.get("confidence", 0.0))}
