import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Hand, AlertCircle } from "lucide-react";

interface GestureDetectorProps {
  onGestureDetected: (gesture: { gesture: string; confidence: number }) => void;
  fps?: number;
}

export const GestureDetector = ({ onGestureDetected, fps = 15 }: GestureDetectorProps) => {
  const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentGesture, setCurrentGesture] = useState<string>("neutral");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;

    const analyzeFrame = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      // Convert to base64
      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      const base64Image = imageData.split(",")[1];

      try {
        // Call backend API
        const response = await fetch("http://localhost:8000/api/dino/detect-gesture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image }),
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentGesture(data.gesture);
          onGestureDetected(data);
        }
      } catch (err) {
        console.error("Gesture detection error:", err);
      }
    };

    setIsAnalyzing(true);
    intervalRef.current = window.setInterval(analyzeFrame, 1000 / fps);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsAnalyzing(false);
    };
  }, [isReady, fps, onGestureDetected]);

  const getGestureIcon = () => {
    switch (currentGesture) {
      case "jump":
        return <span className="text-4xl">✋</span>;
      case "duck":
        return <span className="text-4xl">👇</span>;
      default:
        return <span className="text-4xl">🤚</span>;
    }
  };

  return (
    <Card className="p-4 bg-card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Hand className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Détection de geste</h3>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={startCamera} variant="outline" size="sm" className="mt-2">
              Réessayer
            </Button>
          </Alert>
        )}

        <div className="relative w-full aspect-video bg-background rounded-lg overflow-hidden border border-border">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {isReady && (
            <div className="absolute bottom-4 right-4 bg-primary/90 rounded-full p-3 backdrop-blur-sm">
              {getGestureIcon()}
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute top-4 left-4">
              <div className="bg-green-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                🔴 Analyse en cours
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Geste actuel: <span className="font-bold text-foreground capitalize">{currentGesture}</span>
          </p>
        </div>
      </div>
    </Card>
  );
};
