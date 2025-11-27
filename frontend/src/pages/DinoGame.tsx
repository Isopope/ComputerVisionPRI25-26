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
  
  const lastGestureRef = useRef<{ type: string; time: number } | null>(null);

  useEffect(() => {
    // Valider le mode - Dino n'a que le mode ai-vs-human
    if (mode !== "ai-vs-human") {
      navigate("/");
      return;
    }
  }, [mode, navigate]);

  const handleGestureDetected = (gestureData: { gesture: string; confidence: number }) => {
    const now = Date.now();
    
    console.log("📍 Gesture detected in DinoGame:", gestureData);
    
    // Débounce sur les gestes identiques (300ms cooldown)
    if (
      lastGestureRef.current &&
      lastGestureRef.current.type === gestureData.gesture &&
      now - lastGestureRef.current.time < 300
    ) {
      console.log("⏱️ Debounced (same gesture within 300ms)");
      return;
    }

    // Déclencher les actions du jeu
    if (gestureData.gesture === "jump" && typeof (window as any).dinoJump === "function") {
      console.log("✅ Calling dinoJump()");
      (window as any).dinoJump();
      lastGestureRef.current = { type: "jump", time: now };
    } else if (gestureData.gesture === "duck" && typeof (window as any).dinoDuck === "function") {
      console.log("✅ Calling dinoDuck()");
      (window as any).dinoDuck();
      lastGestureRef.current = { type: "duck", time: now };
    } else {
      console.log("❌ Functions not available:", {
        isJump: gestureData.gesture === "jump",
        hasDinoJump: typeof (window as any).dinoJump === "function",
        isDuck: gestureData.gesture === "duck",
        hasDinoDuck: typeof (window as any).dinoDuck === "function",
      });
    }
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
              onDuck={() => console.log("Duck triggered")}
              onGameOver={handleGameOver}
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
