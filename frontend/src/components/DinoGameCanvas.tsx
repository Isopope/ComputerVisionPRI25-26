import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface DinoGameCanvasProps {
  onJump?: () => void;
  onDuck?: () => void;
  onGameOver?: (score: number) => void;
}

export const DinoGameCanvas = ({ onJump, onDuck, onGameOver }: DinoGameCanvasProps) => {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically import and initialize react-chrome-dino
    import("react-chrome-dino").then((module) => {
      const ChromeDinoGame = module.default;
      // Store reference if needed for control
      gameRef.current = ChromeDinoGame;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        onJump?.();
      } else if (e.code === "ArrowDown") {
        onDuck?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onJump, onDuck]);

  // Simulate jump action
  const triggerJump = () => {
    const spaceEvent = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      keyCode: 32,
      bubbles: true,
    });
    window.dispatchEvent(spaceEvent);
  };

  // Simulate duck action
  const triggerDuck = () => {
    const downEvent = new KeyboardEvent("keydown", {
      code: "ArrowDown",
      key: "ArrowDown",
      keyCode: 40,
      bubbles: true,
    });
    window.dispatchEvent(downEvent);
  };

  // Expose methods to parent
  useEffect(() => {
    if (onJump) {
      (window as any).dinoJump = triggerJump;
    }
    if (onDuck) {
      (window as any).dinoDuck = triggerDuck;
    }
  }, [onJump, onDuck]);

  return (
    <Card className="p-6 bg-card">
      <div className="relative">
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-primary/10 px-4 py-2 rounded-lg">
            <span className="text-2xl font-bold text-foreground">
              Score: {score}
            </span>
          </div>
        </div>
        
        <div 
          id="dino-game-container" 
          className="w-full h-[400px] bg-background rounded-lg border border-border overflow-hidden"
        >
          {/* React Chrome Dino will be rendered here */}
          <iframe
            src="https://chromedino.com/"
            className="w-full h-full border-0"
            title="Dino Game"
          />
        </div>

        {isGameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-bold text-foreground">Game Over!</h3>
              <p className="text-xl text-muted-foreground">Score: {score}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
