# Backend (MVP Charlie)

Objectif: service REST minimal pour « Où est Charlie ».

- Endpoints:
  - POST /api/analyze/charlie (image data URL)
  - GET /api/health
- Réponses: label, confiance, bboxes (en %), temps de traitement.
- Hors scope MVP: WebSocket temps réel, Dobble.

## Analyseurs disponibles

- placeholder: résultat factice pour déverrouiller le frontend.
- yolo11: détection via un modèle YOLO11 (Ultralytics) — nécessite `ultralytics` et les poids.

Sélection par champ `analyzer` dans le body: `"placeholder"` ou `"yolo11"` (défaut: `yolo11`).
Paramètres additionnels:
- `confidence_threshold` (float, défaut 0.25)
- `target_label` (string, optionnel) si votre modèle classe spécifiquement "Charlie".

## Lancement (développement)

1) Créer un environnement Python et installer les dépendances (voir `requirements.txt`).
2) (YOLO11) Placer le fichier de poids Ultralytics dans `backend/` (par ex. `yolo11.pt`) ou définir la variable d'environnement `YOLO11_WEIGHTS` avec le chemin complet.
3) Lancer l’application FastAPI (`backend/main.py`).
4) Vérifier la santé sur `/api/health`.

### Exemple de requête

Body JSON (data URL d'image):

{
  "image": "data:image/png;base64,iVBORw0...",
  "analyzer": "yolo11",
  "confidence_threshold": 0.25,
  "target_label": null
}

Remarques:
- Si `analyzer` = `placeholder`, aucune dépendance Ultralytics n'est requise.
- Si `analyzer` = `yolo11`, installez `ultralytics` (voir requirements) et assurez-vous que les poids existent (`YOLO11_WEIGHTS` ou `backend/yolo11.pt`).
