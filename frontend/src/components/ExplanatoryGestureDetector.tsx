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

interface ExplanatoryGestureDetectorProps {
    onGestureDetected: (gesture: { gesture: string; confidence: number; landmarks?: Landmark[]; raw_gesture?: string }) => void;
    fps?: number;
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
const WS_URL = "ws://localhost:8000/ws/gesture";

export const ExplanatoryGestureDetector = ({ onGestureDetected, fps = 60 }: ExplanatoryGestureDetectorProps) => {
    const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const [currentGesture, setCurrentGesture] = useState<string>("neutral");
    const [rawGesture, setRawGesture] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [wsError, setWsError] = useState<string | null>(null);
    const [realFps, setRealFps] = useState<number>(0);
    const [confidence, setConfidence] = useState<number>(0);

    // WebSocket ref
    const wsRef = useRef<WebSocket | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastSendTimeRef = useRef<number>(0);

    // FPS counter refs
    const frameCountRef = useRef<number>(0);
    const lastFpsUpdateRef = useRef<number>(0);

    // Historique pour lissage temporel
    const gestureHistoryRef = useRef<string[]>([]);
    const GESTURE_HISTORY_MAX = 10;

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    // Fonction pour dessiner les landmarks ET le texte du geste
    const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number, gesture: string, action: string) => {
        ctx.clearRect(0, 0, width, height);

        if (landmarks && landmarks.length > 0) {
            // Dessiner les connexions (skeleton)
            ctx.lineWidth = 6;
            for (const [start, end] of HAND_CONNECTIONS) {
                if (landmarks[start] && landmarks[end]) {
                    const x1 = landmarks[start].x * width;
                    const y1 = landmarks[start].y * height;
                    const x2 = landmarks[end].x * width;
                    const y2 = landmarks[end].y * height;

                    ctx.strokeStyle = "rgb(0, 0, 0)";
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();

                    ctx.strokeStyle = "rgb(255, 255, 255)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    ctx.lineWidth = 6;
                }
            }

            // Dessiner les points (landmarks)
            landmarks.forEach((landmark, index) => {
                const x = landmark.x * width;
                const y = landmark.y * height;
                const mainPoints = [0, 1, 2, 5, 9, 13, 17];
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

        // Affichage enrichi pour le mode explicatif
        if (gesture && gesture !== "neutral") {
            ctx.font = "bold 28px Arial";
            ctx.strokeStyle = "rgb(0, 0, 0)";
            ctx.lineWidth = 4;
            ctx.strokeText(`Geste: ${gesture}`, 15, 40);
            ctx.fillStyle = "rgb(0, 255, 0)";
            ctx.fillText(`Geste: ${gesture}`, 15, 40);

            ctx.font = "bold 24px Arial";
            ctx.strokeStyle = "rgb(0, 0, 0)";
            ctx.lineWidth = 3;
            ctx.strokeText(`Action: ${action}`, 15, 75);
            ctx.fillStyle = "rgb(255, 255, 0)";
            ctx.fillText(`Action: ${action}`, 15, 75);
        } else {
            ctx.font = "bold 24px Arial";
            ctx.strokeStyle = "rgb(0, 0, 0)";
            ctx.lineWidth = 3;
            ctx.strokeText("Aucune main détectée", 15, 40);
            ctx.fillStyle = "rgb(255, 100, 100)";
            ctx.fillText("Aucune main détectée", 15, 40);
        }
    };

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

        const width = videoRef.current.videoWidth || overlayCanvas.width;
        const height = videoRef.current.videoHeight || overlayCanvas.height;

        if (width === 0 || height === 0) return;

        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
            overlayCanvas.width = width;
            overlayCanvas.height = height;
        }

        const rawGest = data.raw_gesture || data.gesture;
        setRawGesture(rawGest);

        gestureHistoryRef.current.push(data.gesture);
        if (gestureHistoryRef.current.length > GESTURE_HISTORY_MAX) {
            gestureHistoryRef.current.shift();
        }

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

        const actionMap: { [key: string]: string } = {
            "jump": "JUMP ✋✊👌☝️",
            "neutral": "NEUTRAL"
        };
        const action = actionMap[mostFrequentGesture] || "NEUTRAL";

        onGestureDetected({
            gesture: mostFrequentGesture,
            confidence: data.confidence,
            landmarks: data.landmarks,
            raw_gesture: rawGest
        });

        setConfidence(data.confidence);
        setLandmarks(data.landmarks || []);

        drawLandmarks(
            overlayCtx,
            data.landmarks || [],
            width,
            height,
            rawGest,
            action
        );
    }, [onGestureDetected, videoRef]);

    useEffect(() => {
        if (!isReady || !videoRef.current || !canvasRef.current) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setWsConnected(true);
            setWsError(null);
        };

        ws.onclose = () => setWsConnected(false);
        ws.onerror = (error) => {
            setWsError("Erreur WebSocket");
            setWsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data.error) processGestureResponse(data);
            } catch (err) {
                console.error(err);
            }
        };

        const sendFrame = (timestamp: number) => {
            if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
            if (wsRef.current.readyState !== WebSocket.OPEN) {
                animationFrameRef.current = requestAnimationFrame(sendFrame);
                return;
            }

            const minInterval = 1000 / fps;
            if (timestamp - lastSendTimeRef.current < minInterval) {
                animationFrameRef.current = requestAnimationFrame(sendFrame);
                return;
            }
            lastSendTimeRef.current = timestamp;

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

            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            if (overlayCanvas.width !== videoWidth || overlayCanvas.height !== videoHeight) {
                overlayCanvas.width = videoWidth;
                overlayCanvas.height = videoHeight;
            }

            const sendWidth = 320;
            const sendHeight = 180;
            canvas.width = sendWidth;
            canvas.height = sendHeight;
            ctx.drawImage(videoRef.current, 0, 0, sendWidth, sendHeight);

            const imageData = canvas.toDataURL("image/jpeg", 0.5);
            try {
                wsRef.current.send(JSON.stringify({ image: imageData }));
            } catch (err) { }

            animationFrameRef.current = requestAnimationFrame(sendFrame);
        };

        setIsAnalyzing(true);
        animationFrameRef.current = requestAnimationFrame(sendFrame);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (wsRef.current) wsRef.current.close();
            setIsAnalyzing(false);
            setWsConnected(false);
        };
    }, [isReady, fps, processGestureResponse]);

    return (
        <Card className="p-4 bg-card border-blue-500 border-2">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Hand className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-blue-500">Mode Explicatif - Debug</h3>
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                        <Button onClick={startCamera} variant="outline" size="sm" className="mt-2">Réessayer</Button>
                    </Alert>
                )}

                <div className="relative w-full aspect-video bg-background rounded-lg overflow-hidden border border-border">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                    <canvas ref={canvasRef} className="hidden" />
                    <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full" style={{ transform: "scaleX(-1)" }} />

                    {isAnalyzing && (
                        <div className="absolute top-4 left-4 flex gap-2">
                            <div className="bg-blue-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">Mode Explicatif</div>
                            <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">{realFps} FPS</div>
                        </div>
                    )}
                </div>

                <div className="text-center p-2 bg-muted rounded">
                    <p className="font-mono text-xs text-muted-foreground">DEBUG_MODE_ACTIVE: TRUE</p>
                    <p className="text-sm">Geste détecté: <span className="font-bold">{currentGesture}</span></p>
                    <p className="text-sm">Confiance: <span className="font-bold">{(confidence * 100).toFixed(0)}%</span></p>
                </div>
            </div>
        </Card>
    );
};
