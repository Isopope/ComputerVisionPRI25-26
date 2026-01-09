/**
 * Service API centralisé pour communiquer avec le backend FastAPI
 */

import { getBackendUrl, API_ENDPOINTS } from './config';
import type {
  AnalyzeCharlieRequest,
  AnalyzeCharlieResponse,
  HealthCheckResponse
} from '@/types/api';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBackendUrl();
  }

  /**
   * Vérifier la santé du backend et du modèle YOLO
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.HEALTH}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }


  /**
   * Analyser une image pour détecter les symboles Dobble
   */
  async analyzeDobble(request: AnalyzeCharlieRequest): Promise<AnalyzeCharlieResponse> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.ANALYZE_DOBBLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Analyze Dobble failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Vérifier si le backend est accessible
   */
  async isBackendAvailable(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch (error) {
      console.error('Backend not available:', error);
      return false;
    }
  }
}

// Export d'une instance unique
export const apiService = new ApiService();

// Export de fonctions wrapper pour une utilisation simplifiée
export const analyzeDobble = (imageBase64: string) => 
  apiService.analyzeDobble({ image: imageBase64 });

export const checkHealth = () => apiService.checkHealth();

export const isBackendAvailable = () => apiService.isBackendAvailable();
