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
 */
export const useYoloAnalysis = () => {
  const { toast } = useToast();

  return useMutation<AnalyzeCharlieResponse, Error, AnalyzeCharlieRequest>({
    mutationFn: (request: AnalyzeCharlieRequest) => apiService.analyzeCharlie(request),
    onSuccess: (data) => {
      console.log("✅ Analyse YOLO réussie:", data);
      toast({
        title: "✅ Analyse terminée",
        description: `${data.result.bounding_boxes.length} élément(s) détecté(s) en ${data.result.processing_time.toFixed(2)}s`,
      });
    },
    onError: (error) => {
      console.error("❌ Erreur lors de l'analyse YOLO:", error);
      toast({
        title: "❌ Erreur d'analyse",
        description: error.message || "Impossible de contacter le backend. Vérifiez que le serveur Python est démarré.",
        variant: "destructive",
      });
    },
  });
};
