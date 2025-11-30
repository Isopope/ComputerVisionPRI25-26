import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, RotateCcw } from "lucide-react";
import { DinoGameCanvas } from "@/components/DinoGameCanvas";
import { GestureDetector } from "@/components/GestureDetector";
import { ScorePanel } from "@/components/ScorePanel";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const DinoGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  const mode = searchParams.get("mode") || "ai-vs-human";
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const lastRawGestureRef = useRef<string>(""); // Dernier geste brut détecté (Open, Close, OK, Pointer)
  const jumpCooldownRef = useRef<number>(0); // Timestamp du dernier saut

  useEffect(() => {
    // Valider le mode - Dino n'a que le mode ai-vs-human
    if (mode !== "ai-vs-human") {
      navigate("/");
      return;
    }
  }, [mode, navigate]);

  const handleGestureDetected = (gestureData: { gesture: string; confidence: number; raw_gesture?: string }) => {
    const now = Date.now();
    const currentRawGesture = gestureData.raw_gesture || gestureData.gesture;
    const previousRawGesture = lastRawGestureRef.current;
    
    // Ignorer si pas de geste (aucune main détectée)
    if (!currentRawGesture || currentRawGesture === "neutral" || currentRawGesture === "") {
      lastRawGestureRef.current = "";
      return;
    }
    
    console.log("📍 Raw gesture:", currentRawGesture, "| Previous:", previousRawGesture);
    
    // Détecter le CHANGEMENT de geste (Open→Close, Close→OK, etc.)
    // Sauter quand le geste change ET qu'il y a un geste valide
    if (currentRawGesture !== previousRawGesture) {
      // Cooldown minimum entre deux sauts (évite les doubles sauts accidentels)
      if (now - jumpCooldownRef.current < 400) {
        console.log("⏱️ Jump cooldown actif");
        lastRawGestureRef.current = currentRawGesture;
        return;
      }
      
      if (typeof (window as any).dinoJump === "function") {
        console.log("✅ JUMP triggered (geste changé:", previousRawGesture, "→", currentRawGesture + ")");
        (window as any).dinoJump();
        jumpCooldownRef.current = now;
      }
    }
    
    // Mettre à jour le geste pour la prochaine détection
    lastRawGestureRef.current = currentRawGesture;
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setIsGameOver(true);
  };

  const handleReplay = () => {
    setScore(0);
    setIsGameOver(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 w-full max-w-7xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            {t("home") || "Accueil"}
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground">
            🦕 {t("dinoRun") || "Dino Run"}
          </h1>

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

        {/* Game Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Game Area */}
          <div className="flex-1">
            <DinoGameCanvas
              onJump={() => console.log("Jump triggered")}
              onGameOver={handleGameOver}
              onScoreUpdate={(newScore) => setScore(newScore)}
            />
          </div>

          {/* Sidebar - Détection de gestes + Score */}
          <div className="w-full lg:w-80 space-y-6">
            <GestureDetector onGestureDetected={handleGestureDetected} />
            <ScorePanel score={score} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DinoGame;
