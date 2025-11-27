import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import ChromeDinoGame from "react-chrome-dino";

interface DinoGameCanvasProps {
  onJump?: () => void;
  onDuck?: () => void;
  onGameOver?: (score: number) => void;
}

export const DinoGameCanvas = ({ onJump, onDuck, onGameOver }: DinoGameCanvasProps) => {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const dinoRef = useRef<any>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const scoreCheckIntervalRef = useRef<number | null>(null);

  // Expose methods to parent for gesture control - ALWAYS register these!
  useEffect(() => {
    (window as any).dinoJump = () => {
      console.log("🦕 JUMP called via gesture");
      
      // Try multiple methods to trigger jump
      const dispatchKeyEvent = (target: any) => {
        const spaceEvent = new KeyboardEvent("keydown", {
          code: "Space",
          key: " ",
          keyCode: 32,
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(spaceEvent);
        
        // Also try keyup
        const spaceEventUp = new KeyboardEvent("keyup", {
          code: "Space",
          key: " ",
          keyCode: 32,
          bubbles: true,
          cancelable: true,
        });
        setTimeout(() => target.dispatchEvent(spaceEventUp), 100);
      };
      
      // Dispatch on window
      dispatchKeyEvent(window);
      // Dispatch on document
      dispatchKeyEvent(document);
      // Dispatch on the game container
      if (gameContainerRef.current) {
        dispatchKeyEvent(gameContainerRef.current);
      }
      
      onJump?.();
    };

    (window as any).dinoDuck = () => {
      console.log("🦕 DUCK called via gesture");
      
      const dispatchKeyEvent = (target: any) => {
        const downEvent = new KeyboardEvent("keydown", {
          code: "ArrowDown",
          key: "ArrowDown",
          keyCode: 40,
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(downEvent);
        
        // Also try keyup
        const downEventUp = new KeyboardEvent("keyup", {
          code: "ArrowDown",
          key: "ArrowDown",
          keyCode: 40,
          bubbles: true,
          cancelable: true,
        });
        setTimeout(() => target.dispatchEvent(downEventUp), 100);
      };
      
      // Dispatch on window
      dispatchKeyEvent(window);
      // Dispatch on document
      dispatchKeyEvent(document);
      // Dispatch on the game container
      if (gameContainerRef.current) {
        dispatchKeyEvent(gameContainerRef.current);
      }
      
      onDuck?.();
    };

    return () => {
      delete (window as any).dinoJump;
      delete (window as any).dinoDuck;
    };
  }, [onJump, onDuck]);

  // Handle keyboard input
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

  // Monitor game state and score
  useEffect(() => {
    const checkGameState = () => {
      if (gameContainerRef.current) {
        // Chercher l'élément de score du jeu
        const scoreElement = gameContainerRef.current.querySelector('[style*="position"]');
        
        // Chercher s'il y a un écran de game over (texte "GAME OVER")
        const gameOverText = gameContainerRef.current.innerText || "";
        
        if (gameOverText.includes("GAME OVER") || gameOverText.includes("Game Over")) {
          if (!isGameOver) {
            setIsGameOver(true);
            onGameOver?.(score);
          }
        }
      }
    };

    scoreCheckIntervalRef.current = window.setInterval(checkGameState, 500);

    return () => {
      if (scoreCheckIntervalRef.current) {
        clearInterval(scoreCheckIntervalRef.current);
      }
    };
  }, [isGameOver, score, onGameOver]);

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
          ref={gameContainerRef}
          className="w-full h-[400px] bg-background rounded-lg border border-border overflow-hidden flex items-center justify-center relative"
        >
          {/* Chrome Dino Game Component */}
          <div className="w-full h-full bg-white">
            <ChromeDinoGame />
          </div>
        </div>

        {isGameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="text-center space-y-4 bg-card p-6 rounded-lg">
              <h3 className="text-3xl font-bold text-foreground">Game Over!</h3>
              <p className="text-xl text-muted-foreground">Score final: {score}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
