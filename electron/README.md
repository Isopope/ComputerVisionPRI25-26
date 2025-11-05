# Charlie Detector - Application Electron

Application de détection de Charlie avec IA (YOLO11) empaquetée avec Electron.

## 🚀 Fonctionnalités

- **Interface moderne** : React + TypeScript + TailwindCSS
- **IA intégrée** : Modèle YOLO11 pour détecter Charlie
- **Backend intégré** : FastAPI + Python automatiquement lancé
- **Empaquetage Windows** : Installation one-click
- **Mode développement** : Hot-reload pour le développement

## 📦 Architecture

```
electron/
├── main.js          # Processus principal Electron
├── preload.js       # Script de sécurité
├── loading.html     # Page de chargement
└── assets/          # Icônes et ressources
```

## 🛠️ Scripts disponibles

### Installation
```bash
install.bat          # Installation complète (Node.js + Python + dépendances)
```

### Développement
```bash
dev.bat              # Mode développement avec hot-reload
npm run electron:dev  # Alternative manuelle
```

### Production
```bash
build.bat            # Build complet et empaquetage
npm run build        # Alternative manuelle
```

## 🔧 Configuration

### Processus principal (main.js)
- Gestion automatique du backend Python
- Vérification de santé du serveur
- Gestion sécurisée des fenêtres
- IPC pour communication avec le frontend

### Empaquetage (package.json)
- Support Windows (NSIS + Portable)
- Inclusion automatique du backend Python
- Optimisation de la taille
- Icônes et métadonnées

## 🐍 Intégration Backend

Le backend Python est automatiquement :
1. **Détecté** : Localisation de l'environnement virtuel
2. **Lancé** : Démarrage sur le port 8000
3. **Surveillé** : Vérification de santé régulière
4. **Arrêté** : Nettoyage lors de la fermeture

## 🌐 Intégration Frontend

Le frontend React est :
1. **Développement** : Chargé depuis `http://localhost:8080`
2. **Production** : Chargé depuis les fichiers statiques
3. **APIs** : Communication avec le backend via Electron IPC

## 📱 APIs Electron exposées

```javascript
// Disponibles dans le frontend via window.electronAPI
electronAPI.checkBackendHealth()  // Vérifier le backend
electronAPI.getBackendUrl()      // URL du backend
electronAPI.getAppInfo()         // Infos de l'application
```

## 🛡️ Sécurité

- **Context Isolation** : Processus renderer isolé
- **Node Integration** : Désactivé dans le renderer
- **Preload Script** : APIs sécurisées uniquement
- **CSP** : Content Security Policy activée

## 📋 Prérequis

### Développement
- Node.js 18+
- Python 3.8+
- Git
- Windows 10/11

### Production
- Modèle YOLO11 (`yolo11.pt`)
- Toutes les dépendances installées

## 🚨 Dépannage

### Backend ne démarre pas
1. Vérifier Python installé : `python --version`
2. Vérifier l'environnement virtuel : `backend/.venv/`
3. Installer manuellement : `cd backend && .venv\Scripts\pip install -r requirements.txt`

### Frontend ne charge pas
1. Vérifier le build : `cd frontend && npm run build`
2. Vérifier les ports : 8080 (dev) / fichiers locaux (prod)
3. Logs dans la console Electron

### Modèle YOLO manquant
1. Placer `yolo11.pt` dans `backend/`
2. Ou laisser YOLO le télécharger automatiquement

## 📊 Performance

- **Démarrage** : ~10-30 secondes (chargement modèle)
- **Analyse** : ~1-2 secondes par image
- **Mémoire** : ~500MB (Python + Electron + Modèle)
- **Taille** : ~200MB empaquetée

## 🎯 Prochaines étapes

- [ ] Optimisation de la taille d'empaquetage
- [ ] Support macOS et Linux
- [ ] Auto-updater intégré
- [ ] Mode offline complet
- [ ] Tests automatisés
