import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Hand, AlertCircle, Wifi, WifiOff } from "lucide-react";

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface GestureDetectorProps {
  onGestureDetected: (gesture: { gesture: string; confidence: number; landmarks?: Landmark[]; raw_gesture?: string }) => void;
  fps?: number;
  showLandmarks?: boolean;
  showDebugInfo?: boolean;
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

// WebSocket URL
import { getBackendUrl } from "@/lib/config";

const getWsUrl = () => {
  const httpUrl = getBackendUrl();
  return httpUrl.replace(/^http/, 'ws') + '/ws/gesture';
};

export const GestureDetector = ({ onGestureDetected, fps = 60, showLandmarks = true, showDebugInfo = true }: GestureDetectorProps) => {
  const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentGesture, setCurrentGesture] = useState<string>("neutral");
  const [rawGesture, setRawGesture] = useState<string>(""); // Geste brut du modèle (Open, Close, etc.)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [realFps, setRealFps] = useState<number>(0);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);

  // FPS counter refs
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  // Historique pour lissage temporel (comme gesture_recognition_simple.py)
  const gestureHistoryRef = useRef<string[]>([]);
  const GESTURE_HISTORY_MAX = 10; // Stocke les 10 dernières prédictions
  const CONFIDENCE_THRESHOLD = 0.6; // Seuil de confiance minimum

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Fonction pour dessiner les landmarks ET le texte du geste
  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number, gesture: string, action: string) => {
    // Effacer le canvas
    ctx.clearRect(0, 0, width, height);

    if (landmarks && landmarks.length > 0) {
      // Dessiner les connexions (skeleton) - comme gesture_recognition_simple.py
      ctx.lineWidth = 6;
      for (const [start, end] of HAND_CONNECTIONS) {
        if (landmarks[start] && landmarks[end]) {
          const x1 = landmarks[start].x * width;
          const y1 = landmarks[start].y * height;
          const x2 = landmarks[end].x * width;
          const y2 = landmarks[end].y * height;

          // Ligne noire épaisse
          ctx.strokeStyle = "rgb(0, 0, 0)";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Ligne blanche fine par dessus
          ctx.strokeStyle = "rgb(255, 255, 255)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.lineWidth = 6;
        }
      }

      // Dessiner les points (landmarks) - comme gesture_recognition_simple.py
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * width;
        const y = landmark.y * height;

        // Points principaux (base des doigts et poignet)
        const mainPoints = [0, 1, 2, 5, 9, 13, 17];
        // Bouts des doigts
        const fingerTips = [4, 8, 12, 16, 20];

        if (mainPoints.includes(index)) {
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgb(0, 0, 0)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (fingerTips.includes(index)) {
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgb(0, 0, 0)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    // Afficher le geste en grand (comme gesture_recognition_simple.py)
    if (gesture && gesture !== "neutral") {
      // Texte "Geste: Open/Close/OK/Pointer"
      ctx.font = "bold 28px Arial";
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 4;
      ctx.strokeText(`Geste: ${gesture}`, 15, 40);
      ctx.fillStyle = "rgb(0, 255, 0)";
      ctx.fillText(`Geste: ${gesture}`, 15, 40);

      // Texte "Action: JUMP/DUCK"
      ctx.font = "bold 24px Arial";
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 3;
      ctx.strokeText(`Action: ${action}`, 15, 75);
      ctx.fillStyle = "rgb(255, 255, 0)";
      ctx.fillText(`Action: ${action}`, 15, 75);
    } else {
      // Pas de main détectée
      ctx.font = "bold 24px Arial";
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 3;
      ctx.strokeText("Aucune main détectée", 15, 40);
      ctx.fillStyle = "rgb(255, 100, 100)";
      ctx.fillText("Aucune main détectée", 15, 40);
    }
  };

  // Fonction pour traiter la réponse du serveur
  const processGestureResponse = useCallback((data: {
    gesture: string;
    raw_gesture: string;
    confidence: number;
    landmarks: Landmark[];
  }) => {
    if (!overlayCanvasRef.current || !videoRef.current) return;

    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) return;

    // S'assurer que le canvas a les bonnes dimensions
    const width = videoRef.current.videoWidth || overlayCanvas.width;
    const height = videoRef.current.videoHeight || overlayCanvas.height;

    if (width === 0 || height === 0) return;

    // Mettre à jour les dimensions si nécessaire
    if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
    }

    // Utiliser raw_gesture directement du backend
    const rawGest = data.raw_gesture || data.gesture;
    setRawGesture(rawGest);

    // Toujours ajouter au lissage temporel (même neutral)
    gestureHistoryRef.current.push(data.gesture);
    if (gestureHistoryRef.current.length > GESTURE_HISTORY_MAX) {
      gestureHistoryRef.current.shift();
    }

    // Calculer le geste le plus fréquent (mode statistique)
    const gestureCount: { [key: string]: number } = {};
    gestureHistoryRef.current.forEach(g => {
      gestureCount[g] = (gestureCount[g] || 0) + 1;
    });

    let mostFrequentGesture = data.gesture;
    let maxCount = 0;
    for (const [gesture, count] of Object.entries(gestureCount)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentGesture = gesture;
      }
    }

    setCurrentGesture(mostFrequentGesture);

    // Mapper le geste vers l'action pour affichage (tous = jump)
    const actionMap: { [key: string]: string } = {
      "jump": "JUMP ✋✊👌☝️",
      "neutral": "NEUTRAL"
    };
    const action = actionMap[mostFrequentGesture] || "NEUTRAL";

    // Toujours envoyer le geste au parent avec le raw_gesture pour la détection de changement
    onGestureDetected({
      gesture: mostFrequentGesture,
      confidence: data.confidence,
      landmarks: data.landmarks,
      raw_gesture: rawGest  // Geste brut: Open, Close, OK, Pointer
    });

    // Stocker et afficher les landmarks + geste
    if (data.landmarks && Array.isArray(data.landmarks)) {
      setLandmarks(data.landmarks);
    }

    // Dessiner sur le canvas overlay (landmarks + texte du geste)
    if (showLandmarks) {
      drawLandmarks(
        overlayCtx,
        data.landmarks || [],
        width,
        height,
        rawGest,
        action
      );
    }
  }, [onGestureDetected, showLandmarks, videoRef]);

  // WebSocket connection et streaming
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;

    // Créer la connexion WebSocket
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔌 WebSocket connecté");
      setWsConnected(true);
      setWsError(null);
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket déconnecté");
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setWsError("Erreur de connexion WebSocket");
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error("❌ Server error:", data.error);
          return;
        }
        processGestureResponse(data);
      } catch (err) {
        console.error("❌ Parse error:", err);
      }
    };

    // Boucle d'envoi des frames avec requestAnimationFrame
    const sendFrame = (timestamp: number) => {
      if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
      if (wsRef.current.readyState !== WebSocket.OPEN) {
        animationFrameRef.current = requestAnimationFrame(sendFrame);
        return;
      }

      // Limiter le FPS
      const minInterval = 1000 / fps;
      if (timestamp - lastSendTimeRef.current < minInterval) {
        animationFrameRef.current = requestAnimationFrame(sendFrame);
        return;
      }
      lastSendTimeRef.current = timestamp;

      // Calculer le FPS réel
      frameCountRef.current++;
      if (timestamp - lastFpsUpdateRef.current >= 1000) {
        setRealFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = timestamp;
      }

      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx || !overlayCanvas) {
        animationFrameRef.current = requestAnimationFrame(sendFrame);
        return;
      }

      // Garder les dimensions de la vidéo originale pour l'overlay (affichage landmarks)
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Ne mettre à jour les dimensions de l'overlay que si elles changent
      if (overlayCanvas.width !== videoWidth || overlayCanvas.height !== videoHeight) {
        overlayCanvas.width = videoWidth;
        overlayCanvas.height = videoHeight;
      }

      // Canvas d'envoi avec résolution réduite (performance)
      const sendWidth = 320;
      const sendHeight = 180;
      canvas.width = sendWidth;
      canvas.height = sendHeight;
      ctx.drawImage(videoRef.current, 0, 0, sendWidth, sendHeight);

      // Convertir en base64 avec compression agressive
      const imageData = canvas.toDataURL("image/jpeg", 0.5);

      try {
        wsRef.current.send(JSON.stringify({ image: imageData }));
      } catch (err) {
        console.error("❌ Send error:", err);
      }

      // Continuer la boucle
      animationFrameRef.current = requestAnimationFrame(sendFrame);
    };

    setIsAnalyzing(true);
    animationFrameRef.current = requestAnimationFrame(sendFrame);

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsAnalyzing(false);
      setWsConnected(false);
    };
  }, [isReady, fps, processGestureResponse]);

  const getGestureIcon = () => {
    switch (currentGesture) {
      case "jump":
        return <span className="text-4xl">✋</span>;
      default:
        return <span className="text-4xl">🤚</span>;
    }
  };

  return (
    <Card className={showDebugInfo ? "p-4 bg-card" : "p-0 border-0 shadow-none bg-transparent"}>
      <div className="space-y-4">
        {showDebugInfo && (
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Détection de geste</h3>
            {showLandmarks && <span className="text-xs text-muted-foreground">(avec landmarks)</span>}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={startCamera} variant="outline" size="sm" className="mt-2">
              Réessayer
            </Button>
          </Alert>
        )}

        {wsError && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>{wsError} - Vérifiez que le backend est lancé</AlertDescription>
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

          {isReady && showDebugInfo && (
            <div className="absolute bottom-4 right-4 bg-primary/90 rounded-full p-3 backdrop-blur-sm">
              {getGestureIcon()}
            </div>
          )}

          {isAnalyzing && showDebugInfo && (
            <div className="absolute top-4 left-4 flex gap-2">
              <div className={`${wsConnected ? 'bg-green-500/80' : 'bg-yellow-500/80'} text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {wsConnected ? 'WebSocket' : 'Connexion...'}
              </div>
              <div className={`${realFps >= fps * 0.9 ? 'bg-green-500/80' : realFps >= fps * 0.5 ? 'bg-yellow-500/80' : 'bg-red-500/80'} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                📊 {realFps} FPS
              </div>
            </div>
          )}

          {showLandmarks && landmarks.length > 0 && (
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
              {landmarks.length} landmarks
            </div>
          )}
        </div>

        {showDebugInfo && (
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
        )}
      </div>
    </Card>
  );
};
