/**
 * Configuration centrale pour l'URL du backend
 */

export const getBackendUrl = (): string => {
  // En mode Electron, utiliser l'IPC pour obtenir l'URL
  if (typeof window !== 'undefined' && (window as any).electron) {
    // L'URL sera fournie par Electron via IPC
    return 'http://127.0.0.1:8000';
  }
  
  // En mode développement
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }
  
  // En production standalone
  return 'http://127.0.0.1:8000';
};

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  ANALYZE_CHARLIE: '/api/analyze/charlie',
  ANALYZE_DOBBLE: '/api/analyze/dobble',
} as const;
