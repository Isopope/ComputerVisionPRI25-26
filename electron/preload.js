const { contextBridge, ipcRenderer } = require('electron');

// Exposer des APIs sécurisées au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Vérifier la santé du backend
  checkBackendHealth: () => ipcRenderer.invoke('check-backend-health'),
  
  // Obtenir l'URL du backend
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  
  // Informations sur l'application
  getAppInfo: () => ({
    platform: process.platform,
    version: process.versions.electron,
    node: process.versions.node
  })
});

// Log pour le debugging
console.log('🔐 Preload script chargé - APIs exposées');