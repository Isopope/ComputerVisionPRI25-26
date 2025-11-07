import { useNavigate } from "react-router-dom";
import { Home, RotateCcw, ArrowRight, HelpCircle } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BoundingBoxOverlay } from "@/components/BoundingBoxOverlay";
import { useLanguage } from "@/hooks/useLanguage";

interface AIPureModeProps {
  gameFromUrl: string | null;
  modeFromUrl: string | null;
  subModeFromUrl: string | null;
  capturedImageFromState: string | null;
  yoloMutation: any; // Type from useYoloAnalysis
}

export const AIPureMode = ({
  gameFromUrl,
  modeFromUrl,
  subModeFromUrl,
  capturedImageFromState,
  yoloMutation,
}: AIPureModeProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />
      
      {/* Navigation en haut */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          {t("backHome")}
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Zone principale */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {yoloMutation.isPending ? "🔍 Analyse en cours…" : "✅ Analyse terminée !"}
            </h1>
            <p className="text-base text-muted-foreground">
              {yoloMutation.isPending 
                ? "L'IA cherche l'élément cible…" 
                : "L'IA a trouvé tous les éléments !"}
            </p>
          </div>

          {/* Zone centrale - Image analysée */}
          <div className="game-card p-6 flex-1 min-h-[400px] relative overflow-hidden">
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center relative">
              {/* Image capturée ou uploadée */}
              {capturedImageFromState ? (
                <img 
                  src={capturedImageFromState} 
                  alt="Captured" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-6xl">{gameFromUrl === "charlie" ? "🧍" : "🎯"}</div>
                </div>
              )}
              
              {/* Overlay IA - Bounding boxes de YOLO */}
              {!yoloMutation.isPending && yoloMutation.data && capturedImageFromState && (
                <BoundingBoxOverlay 
                  image={capturedImageFromState}
                  boundingBoxes={yoloMutation.data.result.bounding_boxes}
                />
              )}
              
              {/* Heatmap overlay */}
              {yoloMutation.isPending && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 animate-pulse" />
              )}
            </div>
            
            {/* Annotations */}
            {!yoloMutation.isPending && yoloMutation.data && (
              <div className="absolute top-4 right-4">
                <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                  {gameFromUrl === "charlie" ? "Charlie détecté ✓" : "Symbole en commun détecté ✓"}
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => navigate(`/pregame?game=${gameFromUrl}&mode=${modeFromUrl}`)}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {subModeFromUrl === "capture" ? "Recapturer" : "Changer d'image"}
            </Button>
            <Button
              variant="accent"
              onClick={() => navigate(`/mode?game=${gameFromUrl}`)}
              className="gap-2"
            >
              Passer au mode suivant
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Zone latérale - Résultats IA */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="game-card p-6 space-y-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              📊 Résultats IA
            </h3>

            {/* Score de confiance */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Score de confiance</span>
                <span className="text-primary font-bold">
                  {yoloMutation.data ? Math.round(yoloMutation.data.result.confidence * 100) : 0}%
                </span>
              </div>
              <Progress 
                value={yoloMutation.data ? yoloMutation.data.result.confidence * 100 : 0} 
                className="h-3" 
              />
            </div>

            {/* Temps de traitement */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-semibold">⏱️ Temps de traitement</span>
              <span className="text-lg font-bold text-secondary">
                {yoloMutation.data ? yoloMutation.data.result.processing_time.toFixed(2) : 0}s
              </span>
            </div>

            {/* Détails des détections */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-semibold">🎯 Éléments détectés</span>
                <span className="text-lg font-bold text-accent">
                  {yoloMutation.data ? yoloMutation.data.result.bounding_boxes.length : 0}
                </span>
              </div>
              
              {yoloMutation.data && yoloMutation.data.result.bounding_boxes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-accent/10 rounded">
                    <span className="text-sm font-medium">📍 Positions trouvées</span>
                    <span className="text-sm font-bold">
                      {yoloMutation.data.result.bounding_boxes.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-accent/10 rounded">
                    <span className="text-sm font-medium">🎯 Meilleure confiance</span>
                    <span className="text-sm font-bold">
                      {Math.round(Math.max(...yoloMutation.data.result.bounding_boxes.map((b: any) => b.confidence)) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton explication */}
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => {
                if (yoloMutation.data) {
                  navigate(`/explanation?game=${gameFromUrl}&mode=${modeFromUrl}`, {
                    state: {
                      yoloResult: yoloMutation.data.result,
                      image: capturedImageFromState
                    }
                  });
                }
              }}
              disabled={yoloMutation.isPending || !yoloMutation.data}
            >
              <HelpCircle className="w-4 h-4" />
              Explication du processus
            </Button>
          </div>

          {/* Stats supplémentaires */}
          <div className="game-card p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎉</div>
              <p className="text-sm font-semibold">
                {yoloMutation.isPending ? "Analyse en cours..." : "Mission accomplie !"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
