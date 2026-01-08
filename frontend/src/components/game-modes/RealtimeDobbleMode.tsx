import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Video, Activity, ArrowLeft } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { useCamera } from "@/hooks/useCamera";

interface RealtimeDobbleModeProps {
    gameFromUrl: string | null;
    modeFromUrl: string | null;
}

export const RealtimeDobbleMode = ({
    gameFromUrl,
    modeFromUrl,
}: RealtimeDobbleModeProps) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { videoRef, isReady, error, startCamera, stopCamera } = useCamera();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<number | null>(null);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [commonSymbol, setCommonSymbol] = useState<string | null>(null);
    const [fps, setFps] = useState(0);
    const [inferenceTime, setInferenceTime] = useState(0);
    const [boundingBoxes, setBoundingBoxes] = useState<any[]>([]);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isReady || !videoRef.current || !canvasRef.current || !overlayCanvasRef.current) return;

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

            const imageData = canvas.toDataURL("image/jpeg", 0.8);
            const startTime = performance.now();

            try {
                const response = await fetch("http://localhost:8000/api/analyze/dobble", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image: imageData,
                        confidence_threshold: 0.3,
                        draw_boxes: false
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const endTime = performance.now();
                    const inference = endTime - startTime;

                    setInferenceTime(inference);
                    setFps(1000 / inference);

                    if (data.detected && data.result.bounding_boxes.length > 0) {
                        setCommonSymbol(data.result.label);
                        setBoundingBoxes(data.result.bounding_boxes);

                        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

                        data.result.bounding_boxes.forEach((bbox: any) => {
                            const x = (bbox.x / 100) * overlayCanvas.width;
                            const y = (bbox.y / 100) * overlayCanvas.height;
                            const width = (bbox.width / 100) * overlayCanvas.width;
                            const height = (bbox.height / 100) * overlayCanvas.height;

                            overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.8)";
                            overlayCtx.lineWidth = 4;
                            overlayCtx.strokeRect(x, y, width, height);

                            overlayCtx.fillStyle = "rgba(0, 255, 0, 0.8)";
                            overlayCtx.font = "bold 16px Arial";
                            overlayCtx.fillText(`${bbox.label} (${Math.round(bbox.confidence * 100)}%)`, x, y - 10);
                        });
                    } else {
                        setCommonSymbol(null);
                        setBoundingBoxes([]);
                        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                    }
                }
            } catch (err) {
                console.error("Analysis error:", err);
            }
        };

        setIsAnalyzing(true);
        intervalRef.current = window.setInterval(analyzeFrame, 500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            setIsAnalyzing(false);
        };
    }, [isReady]);

    return (
        <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
            <AnimatedBackground />

            <div className="relative z-10 w-full max-w-6xl mx-auto flex gap-3 mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/pregame?game=${gameFromUrl || "dobble"}&mode=${modeFromUrl || "realtime"}`)}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t("back")}
                </Button>
                <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
                    <Home className="w-4 h-4" />
                    {t("backHome")}
                </Button>
            </div>

            <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                <div className="flex-1 flex flex-col gap-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                            <Video className="inline w-8 h-8 mr-2" />
                            Dobble - Temps Réel
                        </h1>
                        <p className="text-base text-muted-foreground">
                            Placez deux cartes Dobble devant la caméra
                        </p>
                    </div>

                    <div className="game-card p-6 flex-1 min-h-[500px] relative overflow-hidden">
                        <div className="relative w-full h-full bg-muted rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            <canvas ref={canvasRef} className="hidden" />
                            <canvas
                                ref={overlayCanvasRef}
                                className="absolute inset-0 w-full h-full pointer-events-none"
                            />

                            {isAnalyzing && (
                                <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                    <Activity className="w-4 h-4 animate-pulse" />
                                    Analyse en cours
                                </div>
                            )}

                            {commonSymbol && (
                                <div className="absolute top-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg text-lg font-bold">
                                    Symbole commun: {commonSymbol}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-80 space-y-4">
                    <div className="game-card p-6 space-y-4">
                        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                            Statistiques
                        </h3>

                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="font-semibold">FPS</span>
                            <span className="text-2xl font-bold text-primary">
                                {fps.toFixed(1)}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="font-semibold">Inférence</span>
                            <span className="text-lg font-bold text-secondary">
                                {inferenceTime.toFixed(0)}ms
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="font-semibold">Détections</span>
                            <span className="text-lg font-bold text-accent">
                                {boundingBoxes.length}
                            </span>
                        </div>

                        {commonSymbol && (
                            <div className="p-4 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg text-center">
                                <div className="text-4xl mb-2">{commonSymbol}</div>
                                <p className="text-sm font-semibold">Symbole en commun</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="game-card p-4 bg-destructive/10 border border-destructive">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
