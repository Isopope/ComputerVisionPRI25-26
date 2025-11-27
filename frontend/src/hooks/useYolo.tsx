/**
 * Hooks personnalisés pour l'interaction avec l'API YOLO
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import type { AnalyzeCharlieRequest, AnalyzeCharlieResponse } from "@/types/api";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook pour vérifier la santé du backend
 */
export const useBackendHealth = () => {
  return useQuery({
    queryKey: ['backend-health'],
    queryFn: () => apiService.checkHealth(),
    refetchInterval: 10000, // Vérifier toutes les 10 secondes
    retry: 3,
    staleTime: 5000,
  });
};

/**
 * Hook pour l'analyse YOLO avec mutation
 * @param options.showToast - Afficher ou non les notifications toast (défaut: true)
 */
export const useYoloAnalysis = (options?: { showToast?: boolean }) => {
  const { toast } = useToast();
  const showToast = options?.showToast !== false; // Par défaut true

  return useMutation<AnalyzeCharlieResponse, Error, AnalyzeCharlieRequest>({
    mutationFn: (request: AnalyzeCharlieRequest) => apiService.analyzeCharlie(request),
    onSuccess: (data) => {
      console.log("✅ Analyse YOLO réussie:", data);
      if (showToast) {
        toast({
          title: "✅ Analyse terminée",
          description: `${data.result.bounding_boxes.length} élément(s) détecté(s) en ${data.result.processing_time.toFixed(2)}s`,
        });
      }
    },
    onError: (error) => {
      console.error("❌ Erreur lors de l'analyse YOLO:", error);
      if (showToast) {
        toast({
          title: "❌ Erreur d'analyse",
          description: error.message || "Impossible de contacter le backend. Vérifiez que le serveur Python est démarré.",
          variant: "destructive",
        });
      }
    },
  });
};

/**
 * Hook pour l'analyse Dobble
 * @param options.showToast - Afficher ou non les notifications toast (défaut: true)
 */
export const useYoloDobbleAnalysis = (options?: { showToast?: boolean }) => {
  const { toast } = useToast();
  const showToast = options?.showToast !== false; // Par défaut true

  return useMutation<AnalyzeCharlieResponse, Error, AnalyzeCharlieRequest>({
    mutationFn: (request: AnalyzeCharlieRequest) => apiService.analyzeDobble(request),
    onSuccess: (data) => {
      console.log("✅ Analyse Dobble réussie:", data);
      if (showToast) {
        toast({
          title: "✅ Analyse Dobble terminée",
          description: `${data.result.bounding_boxes.length} symbole(s) détecté(s) en ${data.result.processing_time.toFixed(2)}s`,
        });
      }
    },
    onError: (error) => {
      console.error("❌ Erreur lors de l'analyse Dobble:", error);
      if (showToast) {
        toast({
          title: "❌ Erreur d'analyse Dobble",
          description: error.message || "Impossible de contacter le backend. Vérifiez que le serveur Python est démarré.",
          variant: "destructive",
        });
      }
    },
  });
};
