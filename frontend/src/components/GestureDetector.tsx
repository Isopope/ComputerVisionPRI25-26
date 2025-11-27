import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Hand, AlertCircle } from "lucide-react";

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface GestureDetectorProps {
  onGestureDetected: (gesture: { gesture: string; confidence: number; landmarks?: Landmark[] }) => void;
  fps?: number;
  showLandmarks?: boolean;
}

// Connexions entre les points (skeleton)
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // Pouce
  [0, 5], [5, 6], [6, 7], [7, 8],           // Index
  [0, 9], [9, 10], [10, 11], [11, 12],     // Majeur
  [0, 13], [13, 14], [14, 15], [15, 16],   // Annulaire
  [0, 17], [17, 18], [18, 19], [19, 20],   // Auriculaire
  [5, 9], [9, 13], [13, 17]                 // Ponts entre les doigts
];

export const GestureDetector = ({ onGestureDetected, fps = 15, showLandmarks = true }: GestureDetectorProps) => {
  const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentGesture, setCurrentGesture] = useState<string>("neutral");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Fonction pour dessiner les landmarks
  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number) => {
    if (!landmarks || landmarks.length === 0) return;

    // Dessiner les connexions (skeleton)
    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
    ctx.lineWidth = 2;

    for (const [start, end] of HAND_CONNECTIONS) {
      if (landmarks[start] && landmarks[end]) {
        const x1 = landmarks[start].x * width;
        const y1 = landmarks[start].y * height;
        const x2 = landmarks[end].x * width;
        const y2 = landmarks[end].y * height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Dessiner les points (landmarks)
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * width;
      const y = landmark.y * height;

      // Point principal
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Bordure blanche
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Numéro du point
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(index.toString(), x, y - 12);
    });
  };

  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;

    const analyzeFrame = async () => {
      if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current) return;

      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const overlayCtx = overlayCanvas.getContext("2d");

      if (!ctx || !overlayCtx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      overlayCanvas.width = videoRef.current.videoWidth;
      overlayCanvas.height = videoRef.current.videoHeight;

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
          console.log("🎥 Backend response:", data);
          setCurrentGesture(data.gesture);
          
          // Stocker et afficher les landmarks
          if (data.landmarks && Array.isArray(data.landmarks)) {
            setLandmarks(data.landmarks);
            
            // Dessiner les landmarks sur le canvas overlay
            if (showLandmarks) {
              overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
              drawLandmarks(overlayCtx, data.landmarks, overlayCanvas.width, overlayCanvas.height);
            }
          }
          
          onGestureDetected(data);
        } else {
          console.error("❌ Backend error:", response.status);
        }
      } catch (err) {
        console.error("❌ Gesture detection error:", err);
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
  }, [isReady, fps, onGestureDetected, showLandmarks]);

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
          {showLandmarks && <span className="text-xs text-muted-foreground">(avec landmarks)</span>}
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
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Canvas pour afficher les landmarks */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: "scaleX(-1)" }}
          />
          
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
          
          {showLandmarks && landmarks.length > 0 && (
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
              {landmarks.length} landmarks
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Geste actuel: <span className="font-bold text-foreground capitalize">{currentGesture}</span>
          </p>
          {landmarks.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Points détectés: {landmarks.length}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
