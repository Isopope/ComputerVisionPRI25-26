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

  // Tutorial & Instructions State
  const [showTutorial, setShowTutorial] = useState(mode === "explanatory");
  const [showInstructions, setShowInstructions] = useState(mode !== "explanatory");
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
    if (showTutorial || showInstructions) {
      setLastGestureData(gestureData);
      // En mode tutoriel ou instructions, on ne joue pas au jeu
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
  }, [showTutorial, showInstructions]); // Update dependencies to include showInstructions

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
    // On reste sur le mode actuel ("explanatory") qui affiche les debugs
    // Le setTutorial(false) va débloquer le jeu
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />

      {/* Mode Tutorial: composant isolé en plein écran */}
      {showTutorial ? (
        <EducationalTutorial
          isOpen={showTutorial}
          onComplete={onTutorialComplete}
        />
      ) : (
        /* Mode Jeu normal */
        <div className="relative z-10 w-full max-w-7xl mx-auto space-y-6">
          {/* Overlay Instructions (Uniquement en mode contrôle gestuel) */}
          {showInstructions && mode !== "explanatory" && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="w-full max-w-md bg-card border-2 border-primary/50 rounded-3xl p-8 shadow-2xl space-y-6 transform animate-in zoom-in duration-300">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-primary">
                    {t("howToPlayDino")}
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    {t("dinoJumpInstruction")}
                  </p>
                </div>

                <div className="p-6 bg-muted/50 rounded-2xl space-y-4">
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-center">
                    {t("gestureExamples")}
                  </p>
                  <div className="flex justify-around items-center text-4xl">
                    <div className="flex flex-col items-center gap-2">
                      <span>✋</span>
                      <span className="text-xs font-mono">Open</span>
                    </div>
                    <span className="text-muted-foreground text-2xl">→</span>
                    <div className="flex flex-col items-center gap-2">
                      <span>✊</span>
                      <span className="text-xs font-mono">Close</span>
                    </div>

                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-center italic text-primary/80">
                    {t("gestureChangeTip")}
                  </p>
                  <p className="text-sm text-center font-medium text-muted-foreground">
                    {t("handVisibilityTip")}
                  </p>
                </div>

                <Button
                  onClick={() => setShowInstructions(false)}
                  className="w-full h-14 text-xl font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {t("startPlaying")}
                </Button>
              </div>
            </div>
          )}

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
                onJump={useCallback(() => console.log("Jump triggered"), [])}
                onGameOver={handleGameOver}
                onScoreUpdate={(newScore) => setScore(newScore)}
                paused={showInstructions}
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
      )}
    </div>
  );
};

export default DinoGame;
