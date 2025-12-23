import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import ChromeDinoGame from "react-chrome-dino";
import { useLanguage } from "@/hooks/useLanguage";

interface DinoGameCanvasProps {
  onJump?: () => void;
  onGameOver?: (score: number) => void;
  onScoreUpdate?: (score: number) => void;
  paused?: boolean;
}

export const DinoGameCanvas = ({ onJump, onGameOver, onScoreUpdate, paused = false }: DinoGameCanvasProps) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const dinoRef = useRef<any>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const scoreCheckIntervalRef = useRef<number | null>(null);

  // Expose jump method to parent for gesture control
  useEffect(() => {
    const dispatchKeyDown = (code: string, key: string, keyCode: number) => {
      const event = new KeyboardEvent("keydown", {
        code,
        key,
        keyCode,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      document.dispatchEvent(event);
      if (gameContainerRef.current) {
        gameContainerRef.current.dispatchEvent(event);
      }
    };

    const dispatchKeyUp = (code: string, key: string, keyCode: number) => {
      const event = new KeyboardEvent("keyup", {
        code,
        key,
        keyCode,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      document.dispatchEvent(event);
      if (gameContainerRef.current) {
        gameContainerRef.current.dispatchEvent(event);
      }
    };

    (window as any).dinoJump = () => {
      console.log("🦕 JUMP called via gesture");
      dispatchKeyDown("Space", " ", 32);
      setTimeout(() => dispatchKeyUp("Space", " ", 32), 100);
      onJump?.();
    };

    return () => {
      delete (window as any).dinoJump;
    };
  }, [onJump]);

  // Handle keyboard input (space for jump)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        onJump?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onJump]);

  // Monitor game state and score via Runner global object
  useEffect(() => {
    const checkGameState = () => {
      // Accéder à l'objet Runner global du jeu Chrome Dino
      const runner = (window as any).Runner?.instance_;

      if (runner) {
        // Récupérer le score (distanceRan * coefficient)
        const currentScore = runner.distanceMeter?.getActualDistance(runner.distanceRan) || 0;

        if (currentScore !== score) {
          setScore(currentScore);
          onScoreUpdate?.(currentScore);
        }

        // Vérifier si le jeu est crashé (game over)
        if (runner.crashed && !isGameOver) {
          setIsGameOver(true);
          onGameOver?.(currentScore);
        }

        // Reset si le jeu a redémarré
        if (!runner.crashed && isGameOver) {
          setIsGameOver(false);
          setScore(0);
        }
      }
    };

    // Vérifier plus fréquemment (100ms) pour un score en temps réel
    scoreCheckIntervalRef.current = window.setInterval(checkGameState, 100);

    return () => {
      if (scoreCheckIntervalRef.current) {
        clearInterval(scoreCheckIntervalRef.current);
      }
    };
  }, [isGameOver, score, onGameOver, onScoreUpdate]);

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
              <h3 className="text-3xl font-bold text-foreground">{t("gameOver")}</h3>
              <p className="text-xl text-muted-foreground">{t("finalScoreLabel")} {score}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
