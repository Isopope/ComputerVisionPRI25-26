# Backend FastAPI + ElectronJS - Documentation Technique

## 🎯 Objectif Global

Créer un backend FastAPI empaquété dans ElectronJS pour gérer la reconnaissance d'images pour deux jeux:
1. **Où est Charlie** - Utilise un modèle YOLO11 pré-entraîné
2. **Dobble** - Détection de symboles communs entre deux cartes (modèle YOLO11 + OpenCV)

Le backend doit communiquer avec un frontend React existant via des API REST.

---

## 📐 Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              FRONTEND (React + Vite)                  │  │
│  │  • Routes: /, /select, /mode, /pregame, /game        │  │
│  │  • Communication via fetch() vers localhost:8000     │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              BACKEND (FastAPI)                        │  │
│  │  • Serveur: uvicorn sur localhost:8000               │  │
│  │  • Endpoints: /api/analyze/charlie, /api/analyze/... │  │
│  │  • Modèles IA: YOLO11 (Charlie + Dobble)            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technologies Backend
- **FastAPI** - Framework web asynchrone
- **Uvicorn** - Serveur ASGI
- **YOLO11** (Ultralytics) - Détection pour "Où est Charlie" ET "Dobble"
- **OpenCV** - Annotation d'images et overlays
- **Pillow** - Manipulation d'images
- **Python 3.10+**

### Technologies Electron
- **Electron** - Empaquetage desktop
- **electron-builder** - Build pour Windows/Mac/Linux
- **child_process** - Lancement du serveur FastAPI au démarrage

---

## 🎮 Analyse du Frontend React

### Structure des Routes

1. **`/`** - Page d'accueil (Home)
2. **`/select`** - Sélection du jeu (Charlie ou Dobble)
3. **`/mode`** - Sélection du mode (IA Pure, IA vs Humain, Explicabilité)
4. **`/pregame`** - Préparation (choix sous-mode + capture caméra)
5. **`/game`** - Jeu actif avec analyse

### Paramètres URL Critiques

Le frontend utilise des query params pour gérer l'état:

```typescript
// Exemple: /game?game=charlie&mode=ai-pure&submode=capture
const gameFromUrl = searchParams.get("game");      // "charlie" | "dobble"
const modeFromUrl = searchParams.get("mode");      // "ai-pure" | "ai-vs-human" | "explicability"
const subModeFromUrl = searchParams.get("submode"); // "capture" | "realtime" | null
```

### Modes de Fonctionnement

#### 1. **Mode "IA Pure"** (ai-pure)
L'IA analyse seule, sans compétition. Deux sous-modes:

##### Sous-mode "capture"
- L'utilisateur capture une photo via la caméra
- **Dobble** : Une seule photo contenant les deux cartes côte à côte
- L'image est stockée en base64 dans `location.state.capturedImage`
- Le frontend envoie l'image au backend pour analyse
- Le backend retourne les résultats (bounding boxes, confiance, temps)

##### Sous-mode "realtime" 
- **Actuellement**: Simulation côté frontend (pas de vraie analyse)
- **Future implémentation**: Streaming vidéo frame-by-frame au backend

#### 2. **Mode "IA vs Humain"** (ai-vs-human)
Compétition chronométrée entre l'IA et l'utilisateur.

- **Charlie**: L'IA et l'humain cherchent Charlie, le plus rapide gagne
- **Dobble**: Trouver le symbole commun entre deux cartes

#### 3. **Mode "Explicabilité"** (explicability)
Mode éducatif affichant toutes les détections intermédiaires.

- **Charlie**: Affiche toutes les zones analysées par YOLO11
- **Dobble**: Affiche TOUS les symboles détectés (gris) + symbole commun (vert)

---

## 🔌 API Backend - Spécifications

### Base URL
```
http://localhost:8000/api
```

### Headers Requis
```http
Content-Type: application/json
Accept: application/json
```

---

## 🕵️ Endpoint: Où est Charlie

### **POST /api/analyze/charlie**

Analyse une image pour détecter Charlie avec YOLO11.

#### Request Body

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
  "mode": "ai-pure",
  "submode": "capture",
  "confidence_threshold": 0.5
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `image` | string | Image encodée en base64 (format: `data:image/jpeg;base64,...`) |
| `mode` | string | Mode de jeu: `"ai-pure"`, `"ai-vs-human"`, `"explicability"` |
| `submode` | string | Sous-mode: `"capture"` ou `"realtime"` |
| `confidence_threshold` | float | Seuil de confiance minimum (0.0 - 1.0), défaut: 0.5 |

#### Response Success (200 OK)

```json
{
  "success": true,
  "detected": true,
  "result": {
    "label": "Charlie détecté ✓",
    "confidence": 0.98,
    "processing_time": 2.34,
    "bounding_boxes": [
      {
        "x": 45.2,
        "y": 32.1,
        "width": 8.5,
        "height": 12.3,
        "confidence": 0.98
      }
    ]
  },
  "metadata": {
    "model": "yolo11n",
    "image_size": [640, 480],
    "timestamp": "2025-01-15T10:30:45Z"
  }
}
```

#### Response - Charlie Non Détecté (200 OK)

```json
{
  "success": true,
  "detected": false,
  "result": {
    "label": "Charlie non trouvé",
    "confidence": 0.0,
    "processing_time": 1.85,
    "bounding_boxes": []
  }
}
```

#### Response Error (500)

```json
{
  "success": false,
  "error": "Failed to decode image",
  "details": "Invalid base64 format"
}
```

### Implémentation Backend (charlie.py)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ultralytics import YOLO
import base64
import cv2
import numpy as np
from PIL import Image
import io
import time

router = APIRouter()

# Charger le modèle YOLO11 pré-entraîné
charlie_model = YOLO("models/yolo11_charlie.pt")

class CharlieRequest(BaseModel):
    image: str
    mode: str = "ai-pure"
    submode: str = "capture"
    confidence_threshold: float = 0.5

class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    confidence: float

class CharlieResult(BaseModel):
    label: str
    confidence: float
    processing_time: float
    bounding_boxes: list[BoundingBox]

class CharlieResponse(BaseModel):
    success: bool
    detected: bool
    result: CharlieResult
    metadata: dict = {}

@router.post("/analyze/charlie", response_model=CharlieResponse)
async def analyze_charlie(request: CharlieRequest):
    start_time = time.time()
    
    try:
        # Décoder l'image base64
        image_data = request.image.split(",")[1]  # Retirer "data:image/jpeg;base64,"
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convertir en format OpenCV
        image_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        height, width = image_cv.shape[:2]
        
        # Inférence YOLO11
        results = charlie_model.predict(
            image_cv,
            conf=request.confidence_threshold,
            verbose=False
        )
        
        # Extraire les détections
        bounding_boxes = []
        max_confidence = 0.0
        
        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf > max_confidence:
                    max_confidence = conf
                
                # Coordonnées normalisées (pourcentage)
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bounding_boxes.append(BoundingBox(
                    x=(x1 / width) * 100,
                    y=(y1 / height) * 100,
                    width=((x2 - x1) / width) * 100,
                    height=((y2 - y1) / height) * 100,
                    confidence=conf
                ))
        
        processing_time = time.time() - start_time
        detected = len(bounding_boxes) > 0
        
        return CharlieResponse(
            success=True,
            detected=detected,
            result=CharlieResult(
                label="Charlie détecté ✓" if detected else "Charlie non trouvé",
                confidence=max_confidence,
                processing_time=round(processing_time, 2),
                bounding_boxes=bounding_boxes
            ),
            metadata={
                "model": "yolo11n",
                "image_size": [width, height],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 🎯 API Spécification : Dobble

### Approche technique YOLO11

Le backend utilise un **modèle YOLO11 pré-entraîné** (`.pt`) pour détecter les symboles sur les cartes Dobble.

**Pipeline de traitement** :
1. **Détection YOLO** : Analyse de l'image unique contenant les deux cartes
2. **Matching par intersection** : Comparaison des noms de classes détectées (ex: "dog", "heart")
3. **Annotation OpenCV** : Dessin des bounding boxes sur l'image
4. **Génération du zoom** : Extraction et juxtaposition des symboles communs

### Modes de rendu

**Mode `ai-pure` / `ai-vs-human`** :
- ✅ Bounding boxes UNIQUEMENT sur le symbole commun (vert)

**Mode `explicability`** :
- ✅ TOUTES les bounding boxes en gris
- ✅ Symbole commun en vert (par-dessus)

### Endpoint Backend

**Route** : `POST /api/analyze/dobble`

**Request Body** :

```json
{
  "image": "base64_encoded_string",
  "mode": "ai-pure",
  "submode": "capture",
  "show_zoom": true,
  "show_all_boxes": false
}
```

**Paramètres** :
- `image` : Image unique contenant les deux cartes Dobble côte à côte
- `mode` : Mode de jeu (`ai-pure`, `ai-vs-human`, `explicability`)
- `submode` : `capture` ou `realtime`
- `show_zoom` : Afficher le zoom des symboles communs (coin supérieur droit)
- `show_all_boxes` : `true` pour mode `explicability`, `false` sinon

**Response Success** :

```json
{
  "success": true,
  "detected": true,
  "result": {
    "label": "Symbole en commun détecté ✓",
    "common_symbol": "dog",
    "confidence": 0.92,
    "processing_time": 0.23,
    "annotated_image": "base64_encoded_annotated_image_with_bboxes_and_optional_zoom",
    "card1_symbols": ["dog", "tree", "star", "heart", "sun", "moon", "flower", "apple"],
    "card2_symbols": ["dog", "house", "car", "balloon", "cloud", "fish", "bird", "key"],
    "bounding_boxes": [
      {
        "card": 1,
        "symbol": "dog",
        "x": 25.5,
        "y": 30.2,
        "width": 15.0,
        "height": 20.0
      },
      {
        "card": 2,
        "symbol": "dog",
        "x": 65.5,
        "y": 35.8,
        "width": 14.5,
        "height": 19.2
      }
    ],
    "zoom_overlay": {
      "enabled": true,
      "position": { "x": 1600, "y": 20 },
      "size": { "width": 300, "height": 150 }
    }
  }
}
```

**Champs clés** :
- `annotated_image` : Image base64 avec bounding boxes dessinées (statique)
- `bounding_boxes` : Coordonnées normalisées (%) pour l'animation pulse en frontend
- `zoom_overlay` : Métadonnées du zoom (déjà inclus dans `annotated_image`)

**Response - Pas de Symbole Commun** :

```json
{
  "success": true,
  "detected": false,
  "result": {
    "label": "Aucun symbole commun détecté",
    "processing_time": 1.23,
    "annotated_image": "base64_encoded_image"
  }
}
```

### Implémentation Python (Dobble)

**Fichier** : `backend/routes/dobble.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import base64
import cv2
import numpy as np
from ultralytics import YOLO
import time

router = APIRouter()

# Chargement du modèle YOLO11 pré-entraîné
dobble_model = YOLO("models/dobble_yolo11.pt")

class DobbleRequest(BaseModel):
    image: str
    mode: str
    submode: str = "capture"
    show_zoom: bool = True
    show_all_boxes: bool = False

class BoundingBox(BaseModel):
    card: int
    symbol: str
    x: float
    y: float
    width: float
    height: float

class DobbleResponse(BaseModel):
    success: bool
    detected: bool
    result: Optional[dict] = None

def decode_image(base64_str: str) -> np.ndarray:
    """Décode une image base64 en array OpenCV"""
    image_data = base64.b64decode(base64_str)
    image_array = np.frombuffer(image_data, np.uint8)
    return cv2.imdecode(image_array, cv2.IMREAD_COLOR)

def encode_image(image: np.ndarray) -> str:
    """Encode une image OpenCV en base64"""
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')

def draw_bounding_boxes(image: np.ndarray, detections: List[dict], common_symbol: str, show_all: bool):
    """
    Dessine les bounding boxes sur l'image
    
    Args:
        image: Image OpenCV
        detections: Liste des détections YOLO
        common_symbol: Nom du symbole commun
        show_all: True pour mode explicability (toutes les boxes)
    """
    h, w = image.shape[:2]
    
    for det in detections:
        x, y, width, height = det['bbox']
        x1, y1 = int(x * w / 100), int(y * h / 100)
        x2, y2 = int((x + width) * w / 100), int((y + height) * h / 100)
        
        # Couleur selon le symbole
        if det['symbol'] == common_symbol:
            color = (0, 255, 0)  # Vert pour symbole commun
            thickness = 3
        elif show_all:
            color = (128, 128, 128)  # Gris pour autres symboles
            thickness = 2
        else:
            continue  # Skip si pas en mode explicability
        
        cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)
        
        # Label
        label = f"{det['symbol']} {det['confidence']:.2f}"
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
        cv2.rectangle(image, (x1, y1 - text_h - 10), (x1 + text_w, y1), color, -1)
        cv2.putText(image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

def create_zoom_overlay(image: np.ndarray, common_boxes: List[dict], position: tuple, size: tuple):
    """
    Crée un overlay zoomé des symboles communs
    
    Args:
        image: Image source
        common_boxes: Bounding boxes des symboles communs (card1 et card2)
        position: (x, y) coin supérieur gauche
        size: (width, height) de l'overlay
    """
    h, w = image.shape[:2]
    overlay_w, overlay_h = size
    half_w = overlay_w // 2
    
    # Extraction des deux symboles
    crops = []
    for box in common_boxes[:2]:  # card1 et card2
        x, y, width, height = box['bbox']
        x1, y1 = int(x * w / 100), int(y * h / 100)
        x2, y2 = int((x + width) * w / 100), int((y + height) * h / 100)
        
        crop = image[y1:y2, x1:x2]
        crop_resized = cv2.resize(crop, (half_w - 10, overlay_h - 10))
        crops.append(crop_resized)
    
    # Création de l'overlay
    overlay = np.ones((overlay_h, overlay_w, 3), dtype=np.uint8) * 255
    
    if len(crops) >= 2:
        overlay[5:overlay_h-5, 5:half_w-5] = crops[0]
        overlay[5:overlay_h-5, half_w+5:overlay_w-5] = crops[1]
        
        # Séparateur vertical
        cv2.line(overlay, (half_w, 0), (half_w, overlay_h), (200, 200, 200), 2)
    
    # Bordure
    cv2.rectangle(overlay, (0, 0), (overlay_w-1, overlay_h-1), (0, 255, 0), 3)
    
    # Placement sur l'image principale
    x, y = position
    x = min(x, w - overlay_w)
    y = min(y, h - overlay_h)
    
    image[y:y+overlay_h, x:x+overlay_w] = overlay

@router.post("/analyze/dobble", response_model=DobbleResponse)
async def analyze_dobble(request: DobbleRequest):
    try:
        start_time = time.time()
        
        # Décodage de l'image
        image = decode_image(request.image)
        h, w = image.shape[:2]
        
        # Détection YOLO
        results = dobble_model(image, conf=0.5)
        
        # Extraction des détections
        detections = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                
                symbol_name = dobble_model.names[cls_id]
                
                detections.append({
                    "symbol": symbol_name,
                    "confidence": conf,
                    "bbox": [
                        (x1 / w) * 100,
                        (y1 / h) * 100,
                        ((x2 - x1) / w) * 100,
                        ((y2 - y1) / h) * 100
                    ]
                })
        
        # Regroupement par carte (heuristique : gauche vs droite)
        mid_x = w / 2
        card1_detections = [d for d in detections if (d['bbox'][0] + d['bbox'][2]/2) * w / 100 < mid_x]
        card2_detections = [d for d in detections if (d['bbox'][0] + d['bbox'][2]/2) * w / 100 >= mid_x]
        
        # Matching par intersection
        card1_symbols = set([d['symbol'] for d in card1_detections])
        card2_symbols = set([d['symbol'] for d in card2_detections])
        common_symbols = card1_symbols.intersection(card2_symbols)
        
        if not common_symbols:
            return DobbleResponse(
                success=True,
                detected=False,
                result={
                    "label": "Aucun symbole commun détecté",
                    "processing_time": time.time() - start_time,
                    "annotated_image": encode_image(image)
                }
            )
        
        common_symbol = list(common_symbols)[0]
        
        # Annotation de l'image
        annotated_image = image.copy()
        draw_bounding_boxes(annotated_image, detections, common_symbol, request.show_all_boxes)
        
        # Overlay zoom
        common_boxes = [d for d in detections if d['symbol'] == common_symbol]
        zoom_position = (w - 320, 20)
        zoom_size = (300, 150)
        
        if request.show_zoom and len(common_boxes) >= 2:
            create_zoom_overlay(annotated_image, common_boxes, zoom_position, zoom_size)
        
        # Préparation des bounding boxes pour le frontend
        bounding_boxes = [
            BoundingBox(
                card=1 if i < len(card1_detections) else 2,
                symbol=d['symbol'],
                x=d['bbox'][0],
                y=d['bbox'][1],
                width=d['bbox'][2],
                height=d['bbox'][3]
            )
            for i, d in enumerate([d for d in detections if d['symbol'] == common_symbol])
        ]
        
        processing_time = time.time() - start_time
        
        return DobbleResponse(
            success=True,
            detected=True,
            result={
                "label": "Symbole en commun détecté ✓",
                "common_symbol": common_symbol,
                "confidence": min([d['confidence'] for d in common_boxes]),
                "processing_time": processing_time,
                "annotated_image": encode_image(annotated_image),
                "card1_symbols": list(card1_symbols),
                "card2_symbols": list(card2_symbols),
                "bounding_boxes": [box.dict() for box in bounding_boxes],
                "zoom_overlay": {
                    "enabled": request.show_zoom,
                    "position": {"x": zoom_position[0], "y": zoom_position[1]},
                    "size": {"width": zoom_size[0], "height": zoom_size[1]}
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Points clés de l'implémentation** :
- ✅ Détection YOLO11 sur image unique avec les deux cartes
- ✅ Heuristique simple pour séparer card1/card2 (milieu de l'image)
- ✅ Matching par intersection des noms de classes
- ✅ Annotation OpenCV avec logique conditionnelle (mode explicability)
- ✅ Génération du zoom côte à côte (300x150px, coin supérieur droit)

---

## ⚡ Endpoint: Real-time Streaming (Optionnel)

### **WebSocket /ws/realtime**

Pour le sous-mode `realtime`, le frontend peut établir une connexion WebSocket pour envoyer des frames en continu.

#### Frontend (JavaScript/React)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/realtime');

ws.onopen = () => {
  console.log('WebSocket connecté');
  
  // Envoyer frames depuis la caméra
  const sendFrame = () => {
    const canvas = document.createElement('canvas');
    const video = document.querySelector('video');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    ws.send(JSON.stringify({
      type: 'frame',
      image: imageData,
      game: 'charlie'
    }));
  };
  
  setInterval(sendFrame, 200); // 5 FPS
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.detected) {
    console.log('Détection:', data.result);
    // Afficher les résultats en temps réel
  }
};
```

#### Backend (Python - FastAPI WebSocket)

```python
from fastapi import WebSocket
import json

@app.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_text()
            frame_data = json.loads(data)
            
            game = frame_data.get("game")
            image_base64 = frame_data.get("image")
            
            # Traiter avec le modèle approprié
            if game == "charlie":
                result = await analyze_charlie_frame(image_base64)
            else:
                result = await analyze_dobble_frame(image_base64)
            
            # Envoyer les résultats
            await websocket.send_text(json.dumps(result))
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
```

---

## 🔧 Intégration ElectronJS

### Structure du Projet

```
project/
├── electron/
│   ├── main.js                 # Electron main process
│   └── preload.js
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── routes/
│   │   ├── charlie.py
│   │   └── dobble.py
│   ├── models/
│   │   ├── yolo11_charlie.pt
│   │   └── dobble_yolo11.pt
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── dist/                   # Build Vite
│   └── package.json
└── package.json                # Electron config
```

### electron/main.js

```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let backendProcess = null;

function startBackend() {
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // Mode développement : utiliser uvicorn
    backendProcess = spawn('uvicorn', ['backend.main:app', '--host', '0.0.0.0', '--port', '8000'], {
      cwd: path.join(__dirname, '..'),
      shell: true
    });
  } else {
    // Mode production : utiliser l'exécutable PyInstaller
    const backendPath = path.join(process.resourcesPath, 'backend', 'fastapi-server.exe');
    backendProcess = spawn(backendPath, {
      cwd: path.join(process.resourcesPath, 'backend')
    });
  }
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Charger le frontend
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Vite dev server
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  
  // Attendre que le backend soit prêt
  setTimeout(() => {
    createWindow();
  }, 3000);
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
```

### backend/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import charlie, dobble

app = FastAPI(title="Game AI Backend", version="1.0.0")

# CORS pour permettre les requêtes depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routers
app.include_router(charlie.router, prefix="/api", tags=["Charlie"])
app.include_router(dobble.router, prefix="/api", tags=["Dobble"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### backend/requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
ultralytics==8.1.0
opencv-python==4.9.0
pillow==10.2.0
numpy==1.26.3
pydantic==2.5.3
websockets==12.0
```

---

## 🔨 Build et Déploiement

### 1. Build Backend avec PyInstaller

```bash
# Installer PyInstaller
pip install pyinstaller

# Créer l'exécutable
pyinstaller --name fastapi-server \
  --onefile \
  --add-data "models:models" \
  --hidden-import uvicorn \
  backend/main.py
```

### 2. Build Frontend avec Vite

```bash
cd frontend
npm run build
# Génère frontend/dist/
```

### 3. Package avec Electron Builder

**electron-builder.json**
```json
{
  "appId": "com.gameai.app",
  "productName": "GameAI",
  "directories": {
    "output": "release",
    "buildResources": "resources"
  },
  "files": [
    "electron/**/*",
    "frontend/dist/**/*"
  ],
  "extraResources": [
    {
      "from": "backend/dist/fastapi-server.exe",
      "to": "backend/fastapi-server.exe"
    },
    {
      "from": "backend/models",
      "to": "backend/models"
    }
  ],
  "win": {
    "target": "nsis"
  },
  "mac": {
    "target": "dmg"
  }
}
```

**Build Command**:
```bash
npm run build           # Build frontend + backend
electron-builder build  # Package Electron app
```

---

## 🌐 Communication Frontend ↔ Backend

### 1. Vérification de la Santé du Backend

```typescript
const checkBackendHealth = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/health');
    const data = await response.json();
    console.log('Backend status:', data.status);
    return data.status === 'ok';
  } catch (error) {
    console.error('Backend not available');
    return false;
  }
};
```

### 2. Communication Frontend ↔ Backend

**Exemple depuis React (ActiveGame.tsx)** :

```typescript
const analyzeImage = async (imageBase64: string, game: string, mode: string, submode: string) => {
  try {
    const endpoint = game === 'charlie' 
      ? 'http://localhost:8000/api/analyze/charlie'
      : 'http://localhost:8000/api/analyze/dobble';
    
    const body = game === 'charlie'
      ? {
          image: imageBase64,
          mode,
          submode,
          confidence_threshold: 0.5
        }
      : {
          image: imageBase64,
          mode,
          submode,
          show_zoom: true,
          show_all_boxes: mode === 'explicability'
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    if (data.success && data.detected) {
      console.log('Détection réussie !', data.result);
      
      // Pour Dobble : afficher l'image annotée + overlay Canvas pour animation pulse
      if (game === 'dobble') {
        setAnnotatedImage(data.result.annotated_image);
        setPulseBoundingBoxes(data.result.bounding_boxes);
      }
    }
  } catch (error) {
    console.error('Erreur API:', error);
  }
};
```

### 3. Affichage des Résultats Dobble (Image Annotée + Animation Pulse)

**Architecture hybride** :
- Backend : Renvoie `annotated_image` (base64) avec bounding boxes dessinées statiques
- Frontend : Overlay Canvas transparent pour animation pulse par-dessus

**Composant React (ActiveGame.tsx)** :

```tsx
import { useEffect, useRef } from 'react';

const DobbleResult = ({ annotatedImage, boundingBoxes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Animation pulse avec Canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || boundingBoxes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    let animationFrame: number;
    let phase = 0;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calcul sinusoïdal pour pulse (1 cycle/seconde)
      phase += 0.02;
      const thickness = 3 + Math.sin(phase * 2 * Math.PI) * 2;
      const opacity = 0.5 + Math.sin(phase * 2 * Math.PI) * 0.3;
      
      // Dessin des bounding boxes animées
      boundingBoxes.forEach(box => {
        const x = (box.x / 100) * canvas.width;
        const y = (box.y / 100) * canvas.height;
        const w = (box.width / 100) * canvas.width;
        const h = (box.height / 100) * canvas.height;
        
        ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
        ctx.lineWidth = thickness;
        ctx.strokeRect(x, y, w, h);
      });
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(animationFrame);
  }, [boundingBoxes]);
  
  return (
    <div className="relative">
      {/* Image annotée statique (backend) */}
      <img 
        ref={imageRef}
        src={`data:image/jpeg;base64,${annotatedImage}`}
        alt="Dobble result"
        className="w-full h-auto"
        onLoad={() => {
          if (canvasRef.current && imageRef.current) {
            canvasRef.current.width = imageRef.current.naturalWidth;
            canvasRef.current.height = imageRef.current.naturalHeight;
          }
        }}
      />
      
      {/* Overlay Canvas pour animation pulse */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
```

**Points clés** :
- ✅ `annotated_image` affichée en tant qu'`<img>` (boxes vertes/grises statiques)
- ✅ `<canvas>` transparent en overlay pour animation pulse (juste sur symboles communs)
- ✅ `requestAnimationFrame` pour cycle sinusoïdal fluide (~1 cycle/seconde)
- ✅ Pas besoin de Fabric.js (Canvas natif suffit)

---

## 🧪 Tests et Validation

### Test 1: Health Check

```bash
curl http://localhost:8000/api/health
# Attendu: {"status": "ok", "message": "Backend is running"}
```

### Test 2: Charlie Endpoint

```bash
curl -X POST http://localhost:8000/api/analyze/charlie \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "mode": "ai-pure",
    "submode": "capture",
    "confidence_threshold": 0.5
  }'
```

### Test 3: Dobble Endpoint

```bash
curl -X POST http://localhost:8000/api/analyze/dobble \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "mode": "ai-pure",
    "submode": "capture",
    "show_zoom": true,
    "show_all_boxes": false
  }'
```

---

## 🚀 Workflow de Développement

### Mode Développement

**Terminal 1 - Backend**:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm install
npm run dev
# Vite démarre sur http://localhost:5173
```

**Terminal 3 - Electron**:
```bash
npm install
npm run electron:dev
```

### Mode Production

```bash
# 1. Build backend
pyinstaller --name fastapi-server --onefile backend/main.py

# 2. Build frontend
cd frontend && npm run build

# 3. Package Electron
electron-builder build
```

---

## ⚠️ Notes Importantes

### Performance YOLO11
- **GPU recommandé** : RTX 3060 ou supérieur pour inférence rapide
- **Optimisation CPU** : Utiliser `yolo11n` (nano) pour machines sans GPU
- **Résolution d'entrée** : 640x640px pour équilibre vitesse/précision

### Mémoire
- **Charlie** : ~500 MB RAM (modèle nano)
- **Dobble** : ~600 MB RAM (selon taille du modèle)
- **Electron** : ~200 MB RAM

### Sécurité Electron
- Toujours activer `contextIsolation: true`
- Désactiver `nodeIntegration` dans renderer
- Valider toutes les entrées utilisateur

### Fallback Frontend
Si le backend ne répond pas :
```typescript
if (!backendAvailable) {
  toast.error("Backend indisponible. Vérifiez que le serveur est démarré.");
  // Proposer un mode dégradé ou simulation
}
```

---

## 📋 Checklist Finale

### Backend
- [ ] Modèles YOLO11 chargés correctement
- [ ] Endpoints `/analyze/charlie` et `/analyze/dobble` fonctionnels
- [ ] Gestion d'erreurs robuste (base64 invalide, timeouts)
- [ ] CORS configuré pour le frontend
- [ ] WebSocket optionnel implémenté

### Frontend
- [ ] Capture caméra fonctionnelle (mode `capture`)
- [ ] Communication API avec gestion d'erreurs
- [ ] Affichage des bounding boxes (Charlie)
- [ ] Affichage image annotée + animation pulse (Dobble)
- [ ] Support des 3 modes : `ai-pure`, `ai-vs-human`, `explicability`

### Electron
- [ ] Backend démarre automatiquement au lancement
- [ ] Frontend chargé correctement (dev et prod)
- [ ] Process backend tué proprement à la fermeture
- [ ] Build cross-platform testé (Windows/Mac)

### Tests
- [ ] Test manuel sur image Charlie
- [ ] Test manuel sur image Dobble (deux cartes)
- [ ] Test en mode realtime (WebSocket)
- [ ] Test build production

---

## 📚 Ressources

- [YOLO11 Documentation](https://docs.ultralytics.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [PyInstaller Guide](https://pyinstaller.org/en/stable/)

---

## 📞 Contact

Pour toute question technique sur l'intégration :
- Vérifier les logs backend (`backendProcess.stderr`)
- Inspecter les requêtes réseau dans DevTools
- Tester les endpoints avec `curl` ou Postman

---

## 📊 Formats de Communication

### Format d'Image Attendu
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDA...
```

### Format de Bounding Box (Coordonnées Normalisées)
```typescript
{
  x: 45.2,       // Position X en % (0-100)
  y: 32.1,       // Position Y en % (0-100)
  width: 8.5,    // Largeur en % (0-100)
  height: 12.3,  // Hauteur en % (0-100)
  confidence: 0.98
}
```

### Mode Explicability
Pour activer le mode explicability, ajouter le mode dans `ModeSelection.tsx`:

```tsx
// Dans ModeSelection.tsx
<ModeButton
  mode="explicability"
  icon={Eye}
  onClick={() => handleModeSelect("explicability")}
>
  Mode Explicabilité
</ModeButton>
```

Et gérer dans les endpoints backend via `show_all_boxes: true`.

---

**Version**: 1.0.0  
**Dernière mise à jour**: 2025-01-15  
**Auteur**: Documentation technique pour intégration FastAPI + Electron
