const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

// Alternative à electron-is-dev
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;
let backendProcess = null;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 8080;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`; // IPv4 explicite

// Configuration de l'application
app.setName('Charlie Detector');

// Créer la fenêtre principale
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Charlie Detector - Détection IA',
    show: false, // Ne pas afficher immédiatement
    titleBarStyle: 'default'
  });

  // Afficher la fenêtre une fois prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Ouvrir les DevTools en mode développement
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Gestion de la fermeture de la fenêtre
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBackend();
  });

  // Charger l'application
  await loadApplication();
}

// Démarrer le backend Python
async function startBackend() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🔄 Démarrage du backend YOLO...');

      const backendPath = isDev
        ? path.join(__dirname, '..', 'backend')
        : path.join(process.resourcesPath, 'backend');

      const pythonPath = isDev
        ? path.join(backendPath, '.venv', 'Scripts', 'python.exe')
        : path.join(backendPath, '.venv', 'Scripts', 'python.exe');

      const scriptPath = path.join(backendPath, 'main.py');

      console.log(`🐍 Python: ${pythonPath}`);
      console.log(`📄 Script: ${scriptPath}`);

      // Vérifier que les fichiers existent
      const fs = require('fs');
      if (!fs.existsSync(pythonPath)) {
        throw new Error(`Python non trouvé: ${pythonPath}\n\nUtilisez le script install-python-deps.bat pour installer les dépendances.`);
      }
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script non trouvé: ${scriptPath}`);
      }

      console.log('✅ Fichiers Python trouvés');

      // Lancer le processus backend avec variables d'environnement
      const env = { ...process.env };
      // S'assurer que Python peut trouver les modules
      env.PYTHONPATH = backendPath;

      backendProcess = spawn(pythonPath, [scriptPath], {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env
      });
    } catch (error) {
      console.error('❌ Erreur lors de la préparation du backend:', error);
      // Afficher un message d'erreur à l'utilisateur
      if (mainWindow) {
        dialog.showErrorBox(
          'Erreur de démarrage Python',
          'Impossible de démarrer le backend Python.\n\n' +
          'Erreur: ' + error.message + '\n\n' +
          'Solution: Utilisez le script install-python-deps.bat'
        );
      }
      reject(error);
      return;
    }

    let backendReady = false;

    // Gérer les logs du backend
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString()}`);

      // Vérifier si le serveur est démarré
      if (data.toString().includes('Uvicorn running on') && !backendReady) {
        backendReady = true;
        console.log('✅ Backend démarré avec succès');
        // Attendre un peu plus pour que le serveur soit vraiment prêt
        setTimeout(() => {
          resolve();
        }, 2000);
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
      // Aussi vérifier dans stderr car certains serveurs loggent là
      if (data.toString().includes('Uvicorn running on') && !backendReady) {
        backendReady = true;
        console.log('✅ Backend démarré avec succès (stderr)');
        setTimeout(() => {
          resolve();
        }, 2000);
      }
    });

    backendProcess.on('close', (code) => {
      console.log(`🔴 Backend fermé avec le code: ${code}`);
      if (code !== 0 && code !== null && !backendReady) {
        const errorMsg = `Backend fermé avec le code: ${code}.\n\n` +
          `Cela peut être dû à:\n` +
          `• Dépendances Python manquantes\n` +
          `• Problème avec le modèle YOLO\n` +
          `• Conflit de port\n\n` +
          `Solution: Utilisez install-python-deps.bat`;

        if (mainWindow) {
          dialog.showErrorBox('Erreur Backend Python', errorMsg);
        }
        reject(new Error(errorMsg));
      }
    });

    backendProcess.on('error', (error) => {
      console.error('❌ Erreur backend:', error);
      if (!backendReady) {
        reject(error);
      }
    });

    // Timeout de démarrage plus long
    setTimeout(() => {
      if (!backendReady) {
        reject(new Error('Timeout: Le backend n\'a pas démarré dans les temps'));
      }
    }, 60000); // 60 secondes au lieu de 30
  });
}

// Arrêter le backend
function stopBackend() {
  if (backendProcess) {
    console.log('🛑 Arrêt du backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// Vérifier si le backend est en vie
async function checkBackendHealth() {
  // Essayer différentes URL car il peut y avoir des problèmes IPv6/IPv4
  const urls = [
    `http://127.0.0.1:${BACKEND_PORT}/api/health`,  // IPv4 explicite
    `http://localhost:${BACKEND_PORT}/api/health`,   // localhost
    `${BACKEND_URL}/api/health`                      // URL originale
  ];

  for (const url of urls) {
    try {
      console.log(`🔗 Testing: ${url}`);
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Electron-App'
        }
      });
      if (response.status === 200) {
        console.log(`✅ Health check success: ${url}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ ${url} failed: ${error.message}`);
    }
  }

  return false;
}

// Charger l'application dans la fenêtre
async function loadApplication() {
  try {
    // Afficher un écran de chargement
    mainWindow.loadFile(path.join(__dirname, 'loading.html'));

    // Démarrer le backend
    await startBackend();

    // Attendre que le backend soit prêt avec une vérification plus robuste
    let attempts = 0;
    const maxAttempts = 30; // 30 tentatives * 2 secondes = 60 secondes max

    console.log('🔍 Vérification de la santé du backend...');
    while (attempts < maxAttempts) {
      if (await checkBackendHealth()) {
        console.log('✅ Backend prêt et opérationnel !');
        break;
      }

      console.log(`⏳ Attente du backend... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('⚠️ Le backend ne répond pas aux vérifications de santé, mais on continue...');
      // On continue quand même car le backend semble démarré d'après les logs
    }

    // Charger le frontend
    const frontendUrl = isDev
      ? `http://localhost:${FRONTEND_PORT}`
      : `app://index.html`;

    console.log(`🌐 Chargement du frontend: ${frontendUrl}`);
    await mainWindow.loadURL(frontendUrl);

    console.log('🎉 Application chargée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors du chargement:', error);

    // Afficher une boîte de dialogue d'erreur
    dialog.showErrorBox(
      'Erreur de démarrage',
      `Impossible de démarrer l'application:\n\n${error.message}\n\nVérifiez que Python et les dépendances sont installés.`
    );

    app.quit();
  }
}

// Gestion des événements de l'application
app.whenReady().then(async () => {
  // Enregistrer un protocole personnalisé pour les assets
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Supprimer 'app://'
    const filePath = path.join(process.resourcesPath, 'frontend', url);
    callback({ path: filePath });
  });

  await createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// IPC pour la communication avec le renderer
ipcMain.handle('check-backend-health', async () => {
  return await checkBackendHealth();
});

ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});