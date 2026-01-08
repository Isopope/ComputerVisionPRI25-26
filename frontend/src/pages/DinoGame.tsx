import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { Home, RotateCcw, ArrowLeft } from "lucide-react";
import { DinoGameCanvas } from "@/components/DinoGameCanvas";
import { GestureDetector } from "@/components/GestureDetector";
import { ScorePanel } from "@/components/ScorePanel";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { EducationalTutorial } from "@/components/dino/EducationalTutorial";
import { ExplanatoryGestureDetector } from "@/components/ExplanatoryGestureDetector";

const DinoGame = () => {
  const navigate = useNavigateWithLang();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  const mode = searchParams.get("mode") || "ai-vs-human";
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(mode === "explanatory");
  const [lastGestureData, setLastGestureData] = useState<any>({ gesture: "neutral", confidence: 0, raw_gesture: "neutral" });

  const lastRawGestureRef = useRef<string>("");
  const jumpCooldownRef = useRef<number>(0);

  useEffect(() => {
    // Valider les modes autorisés
    const validModes = ["ai-vs-human", "explanatory"];
    if (!validModes.includes(mode)) {
      navigate("/");
      return;
    }
  }, [mode, navigate]);

  // CRITICAL FIX: Memoize the callback to prevent WebSocket reconnections
  const handleGestureDetected = useCallback((gestureData: { gesture: string; confidence: number; raw_gesture?: string; landmarks?: any[] }) => {
    // Mettre à jour les données pour le tutoriel (si actif)
    if (showTutorial) {
      setLastGestureData(gestureData);
      // En mode tutoriel, on ne joue pas au jeu
      return;
    }

    const now = Date.now();
    const currentRawGesture = gestureData.raw_gesture || gestureData.gesture;
    const previousRawGesture = lastRawGestureRef.current;

    // Ignorer si pas de geste (aucune main détectée)
    if (!currentRawGesture || currentRawGesture === "neutral" || currentRawGesture === "") {
      lastRawGestureRef.current = "";
      return;
    }

    // Détecter le CHANGEMENT de geste
    if (currentRawGesture !== previousRawGesture) {
      if (now - jumpCooldownRef.current < 400) {
        lastRawGestureRef.current = currentRawGesture;
        return;
      }

      if (typeof (window as any).dinoJump === "function") {
        (window as any).dinoJump();
        jumpCooldownRef.current = now;
      }
    }

    lastRawGestureRef.current = currentRawGesture;
  }, [showTutorial]); // Only recreate when showTutorial changes

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setIsGameOver(true);
  };

  const handleReplay = () => {
    setScore(0);
    setIsGameOver(false);
    window.location.reload();
  };

  const onTutorialComplete = () => {
    setShowTutorial(false);
    // Optionnel : rediriger vers le mode jeu normal ou commencer le jeu ici
    // On reste sur le mode actuel ("explanatory") qui affiche les debugs
    // Le setTutorial(false) va débloquer le jeu
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />

      {/* Tutorial Overlay */}
      {showTutorial && (
        <EducationalTutorial
          isOpen={showTutorial}
          onComplete={onTutorialComplete}
          gestureData={lastGestureData}
        />
      )}

      <div className="relative z-10 w-full max-w-7xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/mode?game=dino`)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("back")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              {t("home") || "Accueil"}
            </Button>
          </div>

          <h1 className="text-3xl font-bold text-foreground">
            🦕 {t("dinoRun") || "Dino Run"}
          </h1>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTutorial(true)}
              className="gap-2"
            >
              {t("explanatoryMode")} (?)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplay}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t("replay") || "Rejouer"}
            </Button>
          </div>
        </div>

        {/* Game Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Game Area */}
          <div className="flex-1">
            <DinoGameCanvas
              onJump={() => console.log("Jump triggered")}
              onGameOver={handleGameOver}
              onScoreUpdate={(newScore) => setScore(newScore)}
              paused={showTutorial} // Mettre le jeu en pause si tutoriel
            />
          </div>

          {/* Sidebar - Détection de gestes + Score */}
          <div className="w-full lg:w-80 space-y-6">
            {mode === "explanatory" ? (
              <ExplanatoryGestureDetector
                onGestureDetected={handleGestureDetected}
              />
            ) : (
              <GestureDetector
                onGestureDetected={handleGestureDetected}
                showLandmarks={false}
                showDebugInfo={false}
              />
            )}
            <ScorePanel score={score} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DinoGame;
