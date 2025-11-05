import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, RotateCcw } from "lucide-react";
import { DinoGameCanvas } from "@/components/DinoGameCanvas";
import { GestureDetector } from "@/components/GestureDetector";
import { ScorePanel } from "@/components/ScorePanel";
import { ExplainabilityPanel } from "@/components/ExplainabilityPanel";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

const DinoGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  const mode = searchParams.get("mode") || "ai-vs-human";
  const [score, setScore] = useState(0);
  const [currentGesture, setCurrentGesture] = useState("neutral");
  const [gestureConfidence, setGestureConfidence] = useState(0);
  const [handPosition, setHandPosition] = useState(50);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const lastGestureRef = useRef<{ type: string; time: number } | null>(null);

  useEffect(() => {
    // Redirect if no mode
    if (!mode) {
      navigate("/");
    }
  }, [mode, navigate]);

  const handleGestureDetected = (gestureData: { gesture: string; confidence: number }) => {
    const now = Date.now();
    
    // Debounce identical gestures (300ms cooldown)
    if (
      lastGestureRef.current &&
      lastGestureRef.current.type === gestureData.gesture &&
      now - lastGestureRef.current.time < 300
    ) {
      return;
    }

    setCurrentGesture(gestureData.gesture);
    setGestureConfidence(gestureData.confidence);
    
    // Update hand position for visualization (simulated for now)
    if (gestureData.gesture === "jump") {
      setHandPosition(20);
    } else if (gestureData.gesture === "duck") {
      setHandPosition(80);
    } else {
      setHandPosition(50);
    }

    // Trigger game actions
    if (gestureData.gesture === "jump" && typeof (window as any).dinoJump === "function") {
      (window as any).dinoJump();
      lastGestureRef.current = { type: "jump", time: now };
    } else if (gestureData.gesture === "duck" && typeof (window as any).dinoDuck === "function") {
      (window as any).dinoDuck();
      lastGestureRef.current = { type: "duck", time: now };
    }
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setIsGameOver(true);
  };

  const handleReplay = () => {
    setScore(0);
    setIsGameOver(false);
    window.location.reload(); // Simple reload to restart game
  };

  const isExplicabilityMode = mode === "explicatif";

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
            {t("dinoRun")}
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

          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-6">
            <GestureDetector onGestureDetected={handleGestureDetected} />
            
            {isExplicabilityMode ? (
              <ExplainabilityPanel
                gesture={currentGesture}
                confidence={gestureConfidence}
                handPosition={handPosition}
              />
            ) : (
              <ScorePanel score={score} />
            )}
          </div>
        </div>

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-card p-8 rounded-lg shadow-2xl text-center space-y-6 max-w-md">
              <h2 className="text-4xl font-bold text-foreground">
                {t("finalScore") || "Score final"}
              </h2>
              <p className="text-6xl font-bold text-primary">{score}</p>
              <Button onClick={handleReplay} size="lg" className="w-full">
                <RotateCcw className="w-5 h-5 mr-2" />
                {t("replay") || "Rejouer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DinoGame;
