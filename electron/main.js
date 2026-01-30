const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// --- Configuration ---
const isDev = !app.isPackaged;
const FRONTEND_PORT = 8080;
const DEV_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// Global references
let win = null;
let backendProcess = null;

// --- Window Creation ---
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Wait for ready-to-show
    title: 'Polytech Tours Computer Vision'
  });

  // Load Frontend
  if (isDev) {
    console.log(`🌐 Loading Dev URL: ${DEV_URL}`);
    win.loadURL(DEV_URL);
    win.webContents.openDevTools();
  } else {
    // In production, resources are in resources/frontend
    const indexPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    console.log(`🌐 Loading Production File: ${indexPath}`);

    // Safety check
    const fs = require('fs');
    if (!fs.existsSync(indexPath)) {
      console.error(`❌ Critical: Index not found at ${indexPath}`);
      dialog.showErrorBox('Error', 'Frontend files missing.');
    }

    win.loadFile(indexPath);
    win.removeMenu();
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle new window opening (external links)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Start Backend
  startBackend();
}

// --- Backend Management ---
async function startBackend() {
  if (backendProcess) return; // Already running

  console.log('🔄 Starting Backend...');
  let executablePath;
  let args = [];
  let cwd;
  let env = { ...process.env };

  try {
    if (isDev) {
      // DEV: Use Python script directly
      const backendRoot = path.join(__dirname, '..', 'backend');
      executablePath = path.join(backendRoot, '.venv', 'Scripts', 'python.exe');
      const scriptPath = path.join(backendRoot, 'main.py');

      args = [scriptPath];
      cwd = backendRoot;
      env.PYTHONPATH = backendRoot;

      // Verify files
      const fs = require('fs');
      if (!fs.existsSync(executablePath)) throw new Error(`Python not found: ${executablePath}`);
      if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);

      console.log(`🐍 Dev Backend: ${executablePath} ${args}`);

      backendProcess = spawn(executablePath, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: false
      });

    } else {
      // PROD: Use Docker container
      const projectRoot = path.join(process.resourcesPath, '..');
      executablePath = 'docker-compose';
      args = ['up', '-d', '--build'];
      cwd = projectRoot;

      console.log(`🐳 Prod Backend (Docker): ${executablePath} ${args.join(' ')}`);
      console.log(`   Working directory: ${cwd}`);

      backendProcess = spawn(executablePath, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true, // Required for docker-compose on Windows
        windowsHide: true,
        detached: false
      });
    }

    console.log('✅ Backend process spawned with PID:', backendProcess.pid);

    // Logging
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend]: ${data.toString()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend ERR]: ${data.toString()}`);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`🔴 Backend stopped with code ${code} / signal ${signal}`);
      backendProcess = null;
    });

  } catch (error) {
    console.error('❌ Failed to start backend:', error);
    dialog.showErrorBox('Backend Error', `Failed to start backend:\n${error.message}`);
  }
}

function cleanup() {
  if (isDev) {
    // Dev mode: kill Python process
    if (backendProcess) {
      console.log('🛑 Killing backend process...');
      backendProcess.kill(); // SIGTERM
      backendProcess = null;
    }
  } else {
    // Prod mode: stop Docker container
    console.log('🛑 Stopping Docker container...');
    const projectRoot = path.join(process.resourcesPath, '..');
    spawn('docker-compose', ['down'], {
      cwd: projectRoot,
      shell: true,
      windowsHide: true
    });
  }
}

// --- App Lifecycle ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', cleanup);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---
ipcMain.handle('check-backend-health', async () => {
  try {
    // Use native fetch (Node 18+)
    const response = await fetch(`${BACKEND_URL}/api/health`);
    return response.ok;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('get-backend-url', () => BACKEND_URL);