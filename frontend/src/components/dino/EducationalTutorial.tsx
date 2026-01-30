import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Camera, Brain, Activity, Play, Eye, CheckCircle2, X, FileCode, Database, Trophy, Star, CheckCircle, XCircle, HelpCircle, Video, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";
import { useCamera } from "@/hooks/useCamera";
import { Switch } from "@/components/ui/switch";

interface Landmark {
    x: number;
    y: number;
    z: number;
}

interface GestureData {
    gesture: string;
    raw_gesture?: string;
    confidence: number;
    probabilities?: number[];
    landmarks?: Landmark[];
}

interface EducationalTutorialProps {
    isOpen: boolean;
    onComplete: () => void;
}

// Connexions entre les points (skeleton)
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
];

import { getBackendUrl } from "@/lib/config";

const getWsUrl = () => {
    const httpUrl = getBackendUrl();
    return httpUrl.replace(/^http/, 'ws') + '/ws/gesture';
};

// Composant pour cloner un flux vidéo MediaStream
const VideoClone = ({ srcObject }: { srcObject: MediaStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && srcObject) {
            videoRef.current.srcObject = srcObject;
        }
    }, [srcObject]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
            style={{ transform: "scaleX(-1)" }}
        />
    );
};

export const EducationalTutorial = ({ isOpen, onComplete }: EducationalTutorialProps) => {
    const { t } = useLanguage();
    const [step, setStep] = useState(0);
    const STEPS_COUNT = 8;

    // ===== SYSTÈME DE DÉTECTION DE GESTES INTÉGRÉ =====
    const { videoRef, isReady: isCameraReady, startCamera, stopCamera } = useCamera();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // State pour les données de geste (interne au composant)
    const [gestureData, setGestureData] = useState<GestureData>({
        gesture: "neutral",
        raw_gesture: "neutral",
        confidence: 0,
        landmarks: [],
        probabilities: []
    });
    const [wsConnected, setWsConnected] = useState(false);
    const [realFps, setRealFps] = useState(0);

    // Toggle vue squelette/caméra pour step 1
    const [showCameraView, setShowCameraView] = useState(false);

    // Refs pour le lissage temporel
    const gestureHistoryRef = useRef<string[]>([]);
    const frameCountRef = useRef(0);
    const lastFpsUpdateRef = useRef(0);

    // Quiz State
    const [quizStarted, setQuizStarted] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [quizScore, setQuizScore] = useState(0);
    const [showQuizResult, setShowQuizResult] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

    const [quizCompleted, setQuizCompleted] = useState(false);

    // State pour l'étape Action (maintenant index 5)
    const [prevActionGesture, setPrevActionGesture] = useState<string>("");
    const [jumpTrigger, setJumpTrigger] = useState(false);
    const [jumpCount, setJumpCount] = useState(0);

    // Fonction pour dessiner les landmarks sur le canvas overlay
    const drawLandmarks = useCallback((ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number) => {
        ctx.clearRect(0, 0, width, height);
        if (!landmarks || landmarks.length === 0) return;

        // Dessiner les connexions
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

        // Dessiner les points
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
    }, []);

    // Traitement de la réponse WebSocket
    const processGestureResponse = useCallback((data: any) => {
        // Lissage temporel
        gestureHistoryRef.current.push(data.gesture);
        if (gestureHistoryRef.current.length > 10) {
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

        // Debug: log les landmarks pour vérifier les coordonnées
        if (data.landmarks && data.landmarks.length > 0) {
            console.log("Landmarks[0]:", data.landmarks[0]);
        }

        setGestureData({
            gesture: mostFrequentGesture,
            raw_gesture: data.raw_gesture || data.gesture,
            confidence: data.confidence,
            landmarks: data.landmarks || [],
            probabilities: data.probabilities || []
        });
    }, []);

    // Dessiner les landmarks quand en mode caméra
    useEffect(() => {
        if (!showCameraView || step !== 1 || !overlayCanvasRef.current || !videoRef.current) return;
        if (!gestureData.landmarks || gestureData.landmarks.length === 0) return;

        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Utiliser les dimensions d'affichage du canvas (CSS)
        const rect = canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Dimensions natives de la vidéo
        const videoWidth = videoRef.current.videoWidth || 640;
        const videoHeight = videoRef.current.videoHeight || 480;

        // Calculer le ratio pour object-contain
        const videoRatio = videoWidth / videoHeight;
        const containerRatio = displayWidth / displayHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (videoRatio > containerRatio) {
            // Vidéo plus large - barres en haut/bas
            drawWidth = displayWidth;
            drawHeight = displayWidth / videoRatio;
            offsetX = 0;
            offsetY = (displayHeight - drawHeight) / 2;
        } else {
            // Vidéo plus haute - barres à gauche/droite
            drawHeight = displayHeight;
            drawWidth = displayHeight * videoRatio;
            offsetX = (displayWidth - drawWidth) / 2;
            offsetY = 0;
        }

        // Ajuster les dimensions du canvas pour correspondre à l'affichage CSS
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        // Clear le canvas
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Dessiner les landmarks avec l'offset correct
        const landmarks = gestureData.landmarks;

        // Dessiner les connexions
        ctx.strokeStyle = "rgb(168, 85, 247)";
        ctx.lineWidth = 3;
        for (const [start, end] of HAND_CONNECTIONS) {
            if (landmarks[start] && landmarks[end]) {
                const x1 = offsetX + landmarks[start].x * drawWidth;
                const y1 = offsetY + landmarks[start].y * drawHeight;
                const x2 = offsetX + landmarks[end].x * drawWidth;
                const y2 = offsetY + landmarks[end].y * drawHeight;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        // Dessiner les points
        landmarks.forEach((landmark, index) => {
            const x = offsetX + landmark.x * drawWidth;
            const y = offsetY + landmark.y * drawHeight;
            const fingerTips = [4, 8, 12, 16, 20];

            ctx.fillStyle = fingerTips.includes(index) ? "rgb(34, 197, 94)" : "rgb(255, 255, 255)";
            ctx.beginPath();
            ctx.arc(x, y, fingerTips.includes(index) ? 8 : 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgb(0, 0, 0)";
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }, [gestureData.landmarks, showCameraView, step, videoRef]);

    // Démarrer la caméra et WebSocket (avec délai pour éviter conflit avec l'ancienne caméra)
    useEffect(() => {
        if (!isOpen) return;

        // Délai pour laisser le temps à l'ancienne caméra de se libérer
        const timer = setTimeout(() => {
            startCamera();
        }, 300);

        return () => {
            clearTimeout(timer);
            stopCamera();
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isOpen]);

    // WebSocket et streaming
    useEffect(() => {
        if (!isOpen || !isCameraReady || !videoRef.current || !canvasRef.current) return;

        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => setWsConnected(false);
        ws.onerror = () => setWsConnected(false);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data.error) {
                    processGestureResponse(data);
                }
            } catch (err) {
                console.error("Parse error:", err);
            }
        };

        // Boucle d'envoi des frames
        const sendFrame = (timestamp: number) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !videoRef.current || !canvasRef.current) {
                animationFrameRef.current = requestAnimationFrame(sendFrame);
                return;
            }

            frameCountRef.current++;
            if (timestamp - lastFpsUpdateRef.current >= 1000) {
                setRealFps(frameCountRef.current);
                frameCountRef.current = 0;
                lastFpsUpdateRef.current = timestamp;
            }

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                animationFrameRef.current = requestAnimationFrame(sendFrame);
                return;
            }

            canvas.width = 320;
            canvas.height = 180;
            ctx.drawImage(videoRef.current, 0, 0, 320, 180);

            const imageData = canvas.toDataURL("image/jpeg", 0.5);
            try {
                wsRef.current.send(JSON.stringify({ image: imageData }));
            } catch (err) { }

            animationFrameRef.current = requestAnimationFrame(sendFrame);
        };

        animationFrameRef.current = requestAnimationFrame(sendFrame);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (ws) ws.close();
        };
    }, [isOpen, isCameraReady, processGestureResponse, videoRef]);

    // Détecter le saut (changement de geste) pour l'étape 5
    useEffect(() => {
        if (step !== 5) return;

        const current = gestureData.raw_gesture;
        if (!current || current === "neutral") return;

        if (prevActionGesture && current !== prevActionGesture) {
            setJumpTrigger(true);
            setJumpCount(c => c + 1);
            setTimeout(() => setJumpTrigger(false), 500);
        }

        setPrevActionGesture(current);
    }, [gestureData, step, prevActionGesture]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                if (step < STEPS_COUNT - 1) setStep(s => s + 1);
                else onComplete();
            } else if (e.key === "ArrowLeft") {
                if (step > 0) setStep(s => s - 1);
            } else if (e.key === "Escape") {
                onComplete();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, onComplete, STEPS_COUNT]);

    if (!isOpen) return null;

    const questions = [
        {
            q: t("q1"),
            options: [t("q1_opt1"), t("q1_opt2"), t("q1_opt3")],
            correct: 1
        },
        {
            q: t("q2"),
            options: [t("q2_opt1"), t("q2_opt2"), t("q2_opt3")],
            correct: 1
        },
        {
            q: t("q3"),
            options: [t("q3_opt1"), t("q3_opt2"), t("q3_opt3")],
            correct: 1
        }
    ];

    const handleAnswer = (index: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(index);
        const correct = index === questions[currentQuestion].correct;
        setIsAnswerCorrect(correct);
        if (correct) setQuizScore(s => s + 1);

        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(c => c + 1);
                setSelectedAnswer(null);
                setIsAnswerCorrect(null);
            } else {
                setQuizCompleted(true);
            }
        }, 1500);
    };

    const steps = [
        // STEP 0: VISION
        {
            title: t("computerVisionTitle"),
            icon: <Eye className="w-12 h-12 text-blue-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("whatIsComputerVision")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("computerVisionExplanation")}
                    </p>
                    <div className="p-4 bg-muted rounded-xl border-l-4 border-blue-500">
                        <p className="font-medium">{t("analogy")}</p>
                        <p className="text-sm mt-1">{t("analogyText")}</p>
                    </div>
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full gap-8 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                        <Camera className="w-32 h-32 text-foreground/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full animate-ping" />
                        </div>
                    </div>
                    <ArrowRight className="w-12 h-12 text-muted-foreground rotate-90 md:rotate-0" />
                    <div className="bg-card p-8 rounded-2xl border shadow-2xl flex flex-col items-center">
                        <div className="text-6xl mb-4">💻</div>
                        <div className="font-mono text-xs text-muted-foreground grid grid-cols-4 gap-1">
                            <span>101</span><span>011</span><span>000</span><span>111</span>
                            <span>001</span><span>110</span><span>101</span><span>010</span>
                            <span>111</span><span>000</span><span>011</span><span>101</span>
                        </div>
                    </div>
                </div>
            )
        },
        // STEP 1: SKELETON
        {
            title: t("step1Skeleton"),
            icon: <Brain className="w-12 h-12 text-purple-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("handDetection")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("mediaPipeExplanation")}
                    </p>

                    {/* NOUVEAU : Pipeline 2 IA */}
                    <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border-l-4 border-purple-500 space-y-3">
                        <h3 className="font-bold text-purple-800 dark:text-purple-400 flex items-center gap-2">
                            {t("aiPipelineTitle")}
                        </h3>
                        <p className="text-sm text-purple-900 dark:text-purple-200">
                            {t("aiPipelineExplain")}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-mono bg-white/50 dark:bg-black/20 p-3 rounded-lg overflow-x-auto">
                            <span className="text-2xl">📷</span>
                            <span>→</span>
                            <span className="px-2 py-1 bg-purple-500 text-white rounded font-bold whitespace-nowrap">IA #1: MediaPipe</span>
                            <span>→</span>
                            <span className="text-lg">🖐️ 21 pts</span>
                            <span>→</span>
                            <span className="px-2 py-1 bg-blue-500 text-white rounded font-bold whitespace-nowrap">IA #2: Classificateur</span>
                            <span>→</span>
                            <span className="text-2xl">✋</span>
                        </div>
                    </div>

                    {/* NOUVEAU : Qu'est-ce que MediaPipe */}
                    <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                        <h3 className="font-bold flex items-center gap-2">
                            {t("whatIsMediaPipe")}
                        </h3>
                        <p className="text-sm leading-relaxed">
                            {t("mediaPipeDetail")}
                        </p>
                    </div>

                    {/* NOUVEAU : Comment a-t-elle été entraînée (Annotation) */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800 space-y-2">
                        <h3 className="font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                            {t("howWasItTrained")}
                        </h3>
                        <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed">
                            {t("annotationExplain")}
                        </p>
                        <div className="text-xs font-mono bg-white/50 dark:bg-black/20 p-2 rounded text-center">
                            {t("annotationExample")}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-purple-600 font-bold bg-purple-100 dark:bg-purple-900/20 p-4 rounded-lg">
                        <Brain className="w-6 h-6" />
                        <span>{t("tryMovingHand")}</span>
                    </div>
                </div>
            ),
            visual: (
                <div className="relative w-full h-full bg-black/5 rounded-3xl border-2 border-dashed border-purple-200 flex flex-col items-center justify-center overflow-hidden p-8 gap-4">
                    {/* Toggle Squelette / Caméra */}
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-card/90 backdrop-blur-sm px-4 py-2 rounded-full border shadow-lg">
                        <Layers className={cn("w-5 h-5 transition-colors", !showCameraView ? "text-purple-500" : "text-muted-foreground")} />
                        <Switch
                            checked={showCameraView}
                            onCheckedChange={setShowCameraView}
                            className="data-[state=checked]:bg-purple-500"
                        />
                        <Video className={cn("w-5 h-5 transition-colors", showCameraView ? "text-purple-500" : "text-muted-foreground")} />
                    </div>

                    {/* Status bar */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        <div className={cn("px-3 py-1 rounded-full text-xs font-bold", isCameraReady ? "bg-green-500 text-white" : "bg-yellow-500 text-white")}>
                            {isCameraReady ? "Caméra OK" : "Caméra..."}
                        </div>
                        <div className={cn("px-3 py-1 rounded-full text-xs font-bold", wsConnected ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                            {wsConnected ? "WS Connecté" : "WS Déconnecté"}
                        </div>
                        <div className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold">
                            {realFps} FPS
                        </div>
                    </div>

                    {/* Vue conditionnelle */}
                    {showCameraView ? (
                        /* VUE CAMÉRA avec landmarks superposés */
                        <div className="relative w-full h-full max-w-lg rounded-xl overflow-hidden shadow-2xl border-2 border-purple-300 bg-black flex items-center justify-center">
                            {/* Clone du flux vidéo pour affichage */}
                            {isCameraReady && videoRef.current && videoRef.current.srcObject && (
                                <VideoClone srcObject={videoRef.current.srcObject as MediaStream} />
                            )}
                            {!isCameraReady && (
                                <div className="w-full h-full flex items-center justify-center bg-black/50 text-white">
                                    <span className="animate-pulse">Chargement caméra...</span>
                                </div>
                            )}
                            <canvas
                                ref={overlayCanvasRef}
                                className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                                style={{ transform: "scaleX(-1)" }}
                            />
                            {gestureData.landmarks && gestureData.landmarks.length > 0 && (
                                <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {t("detectedWithIcon")}
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-purple-500/80 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                <Video className="w-3 h-3" /> {t("cameraView")} + Landmarks
                            </div>
                        </div>
                    ) : (
                        /* VUE SQUELETTE PUR - style original */
                        gestureData.landmarks && gestureData.landmarks.length > 0 ? (
                            <div className="relative w-full h-full max-w-md aspect-square bg-white dark:bg-black rounded-xl shadow-2xl p-4 transform transition-all duration-75">
                                <svg className="w-full h-full" viewBox="0 0 1 1" style={{ transform: "scaleX(-1)" }}>
                                    {gestureData.landmarks.map((point, index) => (
                                        <circle
                                            key={index}
                                            cx={point.x}
                                            cy={point.y}
                                            r="0.02"
                                            fill={index % 4 === 0 ? "#a855f7" : "#cbd5e1"}
                                        />
                                    ))}
                                </svg>
                                <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {t("detectedWithIcon")}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="text-6xl animate-bounce">👋</div>
                                <p className="text-xl font-medium text-muted-foreground">{t("raiseHand")}</p>
                            </div>
                        )
                    )}
                </div>
            )
        },
        // STEP 2: DATA TRANSFORMATION
        {
            title: t("stepDataTransformation"),
            icon: <Database className="w-12 h-12 text-blue-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("fromLandmarksToNumbers")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("dataExplanation")}
                    </p>
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-xl border border-blue-200 space-y-2">
                        <div className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <FileCode className="w-5 h-5" /> 21 x 2 = 42
                        </div>
                        <p className="text-sm">{t("mathExplanation")}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                        <h4 className="font-bold text-sm mb-1">{t("normalizationTitle")}</h4>
                        <p className="text-xs text-muted-foreground">{t("normalizationDesc")}</p>
                    </div>
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full gap-6 w-full max-w-2xl">
                    <div className="flex items-center gap-8 w-full justify-center">
                        <div className="relative w-32 h-32 bg-white dark:bg-black rounded-full shadow-lg border-2 border-purple-200 p-2 opacity-80">
                            <svg className="w-full h-full" viewBox="0 0 1 1" style={{ transform: "scaleX(-1)" }}>
                                {gestureData.landmarks?.map((point, index) => (
                                    <circle key={index} cx={point.x} cy={point.y} r="0.04" fill="#a855f7" />
                                ))}
                            </svg>
                        </div>
                        <ArrowRight className="w-8 h-8 text-muted-foreground animate-pulse" />
                        <div className="bg-card border rounded-xl shadow-2xl w-64 h-80 overflow-hidden flex flex-col relative">
                            <div className="bg-muted p-2 text-xs font-mono font-bold text-center border-b">INPUT TENSOR (1x42)</div>
                            <div className="p-4 font-mono text-xs space-y-1 overflow-hidden relative">
                                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                                {gestureData.landmarks ? gestureData.landmarks.map((pt, i) => (
                                    <div key={i} className="flex justify-between text-muted-foreground">
                                        <span>pt_{i}_x:</span> <span className="text-foreground">{(pt.x).toFixed(3)}</span>
                                    </div>
                                )) : (
                                    <div className="text-center mt-10 text-muted-foreground">...</div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )
        },
        // STEP 3: NEURAL NETWORK (TRAINING) - INDEX 3
        {
            title: t("step3TrainingTitle"),
            icon: <Activity className="w-12 h-12 text-pink-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("step3TrainingTitle")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("step3TrainingDesc")}
                    </p>

                    <div className="space-y-4">
                        <div className="p-4 bg-pink-100 dark:bg-pink-900/20 rounded-xl border border-pink-200 dark:border-pink-800">
                            <h3 className="font-bold text-pink-700 dark:text-pink-400 mb-2 flex items-center gap-2">
                                <Activity className="w-5 h-5" /> {t("trainingVsInference")}
                            </h3>
                            <p className="text-sm">{t("trainingAnalogy")}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-xl border border-muted">
                            <p className="text-xs text-muted-foreground italic">{t("neuralNetworkInputDesc")}</p>
                        </div>
                    </div>
                </div>
            ),
            visual: (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-6">
                    {/* Neural Network Visualization - ENLARGED */}
                    <div className="bg-card w-full p-8 rounded-3xl border shadow-xl flex flex-col items-center gap-8">
                        <div className="flex w-full justify-between items-center border-b pb-4">
                            <div className="text-left">
                                <div className="font-bold text-2xl">{t("neuralNetwork")}</div>
                                <div className="font-mono text-xs text-green-500 font-bold">model/keypoint_classifier.tflite</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold">{t("frozenModel")}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 w-full h-64">
                            {/* Inputs (Landmarks) - Numeric Visualization */}
                            <div className="flex flex-col gap-2 justify-center h-full w-1/4 bg-muted/20 rounded-xl p-3 border border-dashed relative">
                                <div className="text-xs text-center font-bold mb-1 uppercase text-muted-foreground whitespace-nowrap">Input (Step 3)</div>
                                <div className="flex-1 w-full overflow-hidden relative font-mono text-[10px] space-y-1">
                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                                    {gestureData.landmarks && gestureData.landmarks.length > 0 ? (
                                        <>
                                            {gestureData.landmarks.slice(0, 10).map((pt, i) => (
                                                <div key={i} className="flex justify-between text-muted-foreground px-1">
                                                    <span>x{i}:</span><span className="text-foreground">{pt.x.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            <div className="text-center text-muted-foreground">...</div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-1 mt-4">
                                            {[...Array(6)].map((_, i) => (
                                                <div key={i} className="w-full h-2 bg-muted-foreground/20 animate-pulse rounded" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <ArrowRight className="text-muted/30 w-8 h-8 flex-shrink-0" />

                            {/* Hidden Layers (Abstract) */}
                            <div className="flex-1 h-full bg-slate-100 dark:bg-slate-900/50 rounded-xl border p-4 relative overflow-hidden group">
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity className="w-32 h-32" />
                                </div>
                                <div className="grid grid-cols-4 gap-4 h-full content-center place-items-center">
                                    {[...Array(16)].map((_, i) => (
                                        <div key={i} className={cn("w-3 h-3 rounded-full transition-colors duration-300",
                                            i % 3 === 0 ? "bg-pink-400 animate-ping" : "bg-slate-300 dark:bg-slate-600")}
                                        />
                                    ))}
                                </div>
                                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground font-mono">Hidden Layers</div>
                            </div>

                            <ArrowRight className="text-muted/30 w-8 h-8 flex-shrink-0" />

                            {/* Outputs (Classes) */}
                            <div className="flex flex-col gap-2 justify-center w-1/4 h-full">
                                <div className="text-xs text-center font-bold mb-1 uppercase text-muted-foreground">Output (Prob.)</div>
                                <div className="flex flex-col gap-4 justify-center h-full">
                                    {/* Class 0: Open */}
                                    <div className={cn("px-2 py-3 rounded-lg border text-sm font-bold transition-all text-center flex flex-col gap-1",
                                        gestureData.raw_gesture === "Open" ? "bg-green-500 text-white scale-110 shadow-lg" : "bg-card opacity-50")}>
                                        <span>OPEN</span>
                                        <span className="text-[10px] opacity-80">
                                            {gestureData.probabilities && gestureData.probabilities.length > 0
                                                ? `${(gestureData.probabilities[0] * 100).toFixed(1)}%`
                                                : (gestureData.raw_gesture === "Open" ? "99%" : "1%")}
                                        </span>
                                    </div>
                                    {/* Class 1: Close */}
                                    <div className={cn("px-2 py-3 rounded-lg border text-sm font-bold transition-all text-center flex flex-col gap-1",
                                        gestureData.raw_gesture === "Close" ? "bg-orange-500 text-white scale-110 shadow-lg" : "bg-card opacity-50")}>
                                        <span>CLOSED</span>
                                        <span className="text-[10px] opacity-80">
                                            {gestureData.probabilities && gestureData.probabilities.length > 1
                                                ? `${(gestureData.probabilities[1] * 100).toFixed(1)}%`
                                                : (gestureData.raw_gesture === "Close" ? "99%" : "1%")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        // STEP 4: CLASSIFICATION
        {
            title: t("step2Classification"),
            icon: <Brain className="w-12 h-12 text-orange-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("shapeRecognition")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("shapeComparison")}
                    </p>
                    <div className="p-4 bg-muted/50 rounded-xl border-l-4 border-orange-500">
                        <p className="text-sm italic">{t("classificationProbabilities")}</p>
                    </div>

                    {/* NOUVEAU : Section Limites du Modèle */}
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl border-l-4 border-yellow-500 space-y-2">
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                            {t("modelLimitations")}
                        </h3>
                        <p className="text-sm text-yellow-900 dark:text-yellow-200 leading-relaxed">
                            {t("modelLimitationsExplain")}
                        </p>
                        <div className="flex gap-2 text-2xl justify-center pt-2 opacity-50 grayscale">
                            <span title="Non reconnu">✌️</span>
                            <span title="Non reconnu">🤘</span>
                            <span title="Non reconnu">👍</span>
                            <span title="Non reconnu">🤙</span>
                            <span className="text-sm self-center">← {t("trainingDataMissing")}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className={cn("p-4 rounded-xl border flex items-center justify-between transition-colors", gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "bg-green-100 border-green-500 dark:bg-green-900/20 shadow-lg scale-105" : "opacity-40 grayscale")}>
                            <span className="font-bold text-lg">{t("classOpen")}</span>
                            <span className="text-4xl">✋</span>
                        </div>
                        <div className={cn("p-4 rounded-xl border flex items-center justify-between transition-colors", gestureData.raw_gesture === "Close" || gestureData.raw_gesture === "Pointer" ? "bg-orange-100 border-orange-500 dark:bg-orange-900/20 shadow-lg scale-105" : "opacity-40 grayscale")}>
                            <span className="font-bold text-lg">{t("classRest")}</span>
                            <span className="text-4xl">✊</span>
                        </div>
                    </div>
                </div>
            ),
            visual: (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-8 bg-black/5 rounded-3xl gap-8">
                    {/* Classification Targets */}
                    <div className="flex w-full justify-between px-8">
                        <div className={cn("w-32 h-32 rounded-2xl border-4 flex flex-col items-center justify-center transition-all duration-300 bg-card", gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "border-green-500 scale-110 shadow-[0_0_30px_rgba(34,197,94,0.3)]" : "border-muted opacity-50")}>
                            <div className="text-5xl mb-2">✋</div>
                            <div className="text-xs font-bold bg-green-500 text-white px-2 py-1 rounded mb-1">{t("open")}</div>
                            {gestureData.probabilities && gestureData.probabilities.length >= 2 && (
                                <div className="text-[10px] font-mono opacity-80">
                                    {(
                                        ((gestureData.probabilities[0] || 0) +
                                            ((gestureData.probabilities.length > 3 ? gestureData.probabilities[3] : 0) || 0))
                                        * 100).toFixed(1)}%
                                </div>
                            )}
                        </div>

                        <div className={cn("w-32 h-32 rounded-2xl border-4 flex flex-col items-center justify-center transition-all duration-300 bg-card", gestureData.raw_gesture === "Close" || gestureData.raw_gesture === "Pointer" ? "border-orange-500 scale-110 shadow-[0_0_30px_rgba(249,115,22,0.3)]" : "border-muted opacity-50")}>
                            <div className="text-5xl mb-2">✊</div>
                            <div className="text-xs font-bold bg-orange-500 text-white px-2 py-1 rounded mb-1">{t("rest")}</div>
                            {gestureData.probabilities && gestureData.probabilities.length >= 2 && (
                                <div className="text-[10px] font-mono opacity-80">
                                    {(
                                        ((gestureData.probabilities[1] || 0) +
                                            ((gestureData.probabilities.length > 2 ? gestureData.probabilities[2] : 0) || 0))
                                        * 100).toFixed(1)}%
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User Hand */}
                    {gestureData.landmarks && gestureData.landmarks.length > 0 ? (
                        <div className="relative w-64 h-64 bg-white dark:bg-black rounded-full shadow-2xl overflow-visible border-4 border-muted flex items-center justify-center">
                            <div className={cn("absolute w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent transition-all duration-300 transform -z-10",
                                gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "text-green-500 -rotate-45 -translate-y-32 -translate-x-32 scale-x-150" :
                                    gestureData.raw_gesture === "Close" ? "text-orange-500 rotate-45 -translate-y-32 translate-x-32 scale-x-150" : "opacity-0"
                            )} />

                            <svg className="w-48 h-48" viewBox="0 0 1 1" style={{ transform: "scaleX(-1)" }}>
                                {gestureData.landmarks.map((point, index) => (
                                    <circle key={index} cx={point.x} cy={point.y} r="0.02" fill={index % 4 === 0 ? "currentColor" : "#94a3b8"} className="text-primary" />
                                ))}
                            </svg>

                            <div className="absolute -bottom-12 bg-background px-4 py-2 rounded-full border shadow font-mono text-sm">
                                {t("input")}: {gestureData.raw_gesture || "?"}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center animate-pulse text-muted-foreground w-64 h-64 flex items-center justify-center border-4 border-dashed rounded-full">
                            {t("waitingForHand")}
                        </div>
                    )}
                </div>
            )
        },
        // STEP 5: ACTION
        {
            title: t("step3Action"),
            icon: <Play className="w-12 h-12 text-red-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("trigger")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("changeDetection")}
                    </p>
                    <div className="p-6 bg-red-100 dark:bg-red-900/20 rounded-xl text-center space-y-2">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{t("actionInstruction")}</p>
                        <div className="text-4xl font-black">{jumpCount} {t("jumps")}</div>
                    </div>

                    {/* NOUVEAU : Rappel des limites */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-800 dark:text-blue-300 text-center">
                            {t("actionLimitation")}
                        </p>
                    </div>
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full gap-8 w-full max-w-lg">
                    <div className="flex items-center gap-4 w-full justify-between">
                        <div className="bg-card border p-4 rounded-xl flex-1 text-center opacity-70">
                            <div className="text-xs uppercase font-bold text-muted-foreground">{t("before")}</div>
                            <div className="text-2xl font-bold">{prevActionGesture || "..."}</div>
                        </div>
                        <ArrowRight className={cn("w-8 h-8 transition-all", jumpTrigger ? "text-red-500 scale-150" : "text-muted-foreground")} />
                        <div className="bg-card border p-4 rounded-xl flex-1 text-center">
                            <div className="text-xs uppercase font-bold text-muted-foreground">{t("now")}</div>
                            <div className="text-2xl font-bold">{gestureData.raw_gesture || "..."}</div>
                        </div>
                    </div>
                    <div className="relative w-full h-40 bg-card border-2 rounded-2xl flex items-center justify-center overflow-hidden">
                        <div className={cn("absolute inset-0 bg-red-500 transition-transform duration-100 ease-out", jumpTrigger ? "translate-y-0" : "translate-y-full")} />
                        <div className={cn("z-10 flex flex-col items-center transition-all duration-100", jumpTrigger ? "scale-150 text-white" : "scale-100 text-muted-foreground")}>
                            {jumpTrigger ? (
                                <>
                                    <span className="text-6xl">🦖</span>
                                    <span className="text-4xl font-black">{t("jump")}</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-4xl grayscale opacity-50">🦖</span>
                                    <span className="text-sm font-bold mt-2">{t("waitingAction")}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        // STEP 6: CONFIDENCE
        {
            title: t("bonusConfidence"),
            icon: <Activity className="w-12 h-12 text-teal-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("confidenceScoreTitle")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("confidenceExplanation")}
                    </p>
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto space-y-8">
                    <div className="relative w-64 h-64">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="20" fill="transparent" className="text-muted/20" />
                            <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="20" fill="transparent"
                                className={cn("transition-all duration-300", gestureData.confidence > 0.8 ? "text-green-500" : gestureData.confidence > 0.5 ? "text-yellow-500" : "text-red-500")}
                                strokeDasharray={2 * Math.PI * 120}
                                strokeDashoffset={2 * Math.PI * 120 * (1 - gestureData.confidence)}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-mono font-bold">{(gestureData.confidence * 100).toFixed(0)}%</span>
                            <span className="text-sm text-muted-foreground">{t("confidenceLabel")}</span>
                        </div>
                    </div>
                </div>
            )
        },
        // STEP 7: QUIZ
        {
            title: t("quizTitle"),
            icon: <Trophy className="w-12 h-12 text-yellow-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">
                        {quizCompleted ? t("results") : t("question") + ` ${currentQuestion + 1}/${questions.length}`}
                    </h2>

                    {!quizStarted ? (
                        <div className="space-y-4">
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                {t("quizIntro")}
                            </p>
                            <Button onClick={() => setQuizStarted(true)} className="w-full py-6 text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0">
                                <Play className="w-6 h-6 mr-2 fill-current" />
                                {t("startQuiz")}
                            </Button>
                        </div>
                    ) : quizCompleted ? (
                        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                            <div className="p-6 bg-card border-2 rounded-2xl flex flex-col items-center gap-4">
                                <div className="text-sm uppercase font-bold text-muted-foreground">{t("score")}</div>
                                <div className="text-6xl font-black text-primary">
                                    {quizScore}/{questions.length}
                                </div>
                                <div className="flex gap-2">
                                    {[...Array(3)].map((_, i) => (
                                        <Star key={i} className={cn("w-8 h-8", i < quizScore ? "text-yellow-500 fill-yellow-500" : "text-muted")} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-center text-xl font-medium">
                                {quizScore === 3 ? t("quizPerfect") : quizScore > 0 ? t("quizGood") : t("quizTryAgain")}
                            </p>
                            <Button onClick={onComplete} variant="outline" className="w-full">
                                {t("finish")}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xl font-medium mb-6">{questions[currentQuestion].q}</p>
                            <div className="space-y-3">
                                {questions[currentQuestion].options.map((opt, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        disabled={selectedAnswer !== null}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group hover:shadow-md",
                                            selectedAnswer === null
                                                ? "hover:bg-accent hover:border-primary/50"
                                                : selectedAnswer === idx
                                                    ? (idx === questions[currentQuestion].correct ? "bg-green-500 text-white border-green-600" : "bg-red-500 text-white border-red-600")
                                                    : (idx === questions[currentQuestion].correct ? "bg-green-100 dark:bg-green-900/30 border-green-500" : "opacity-50")
                                        )}
                                    >
                                        <span className="font-medium">{opt}</span>
                                        {selectedAnswer === idx && (
                                            idx === questions[currentQuestion].correct
                                                ? <CheckCircle className="w-5 h-5" />
                                                : <XCircle className="w-5 h-5" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center w-full h-full">
                    {!quizStarted ? (
                        <div className="relative group cursor-pointer" onClick={() => setQuizStarted(true)}>
                            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full group-hover:bg-yellow-500/30 transition-all duration-500" />
                            <HelpCircle className="w-64 h-64 text-yellow-500 relative z-10 animate-bounce group-hover:scale-110 transition-transform duration-300" />
                        </div>
                    ) : quizCompleted ? (
                        <div className="relative">
                            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse" />
                            <Trophy className="w-64 h-64 text-yellow-500 relative z-10 animate-in zoom-in spin-in-12 duration-700" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 w-full max-w-lg p-4">
                            {/* Contextual Visual hint based on question */}
                            {currentQuestion === 0 && (
                                <div className="col-span-2 flex justify-center animate-in fade-in">
                                    <div className="relative w-48 h-48 bg-black rounded-xl border-2 border-purple-500 p-2">
                                        <svg className="w-full h-full" viewBox="0 0 1 1" style={{ transform: "scaleX(-1)" }}>
                                            {gestureData.landmarks?.map((point, index) => (
                                                <circle key={index} cx={point.x} cy={point.y} r="0.03" fill="#a855f7" />
                                            ))}
                                        </svg>
                                        <div className="absolute top-2 right-2"><Brain className="w-6 h-6 text-purple-500" /></div>
                                    </div>
                                </div>
                            )}
                            {currentQuestion === 1 && (
                                <div className="col-span-2 flex justify-center gap-8 animate-in fade-in">
                                    <div className="text-6xl animate-bounce">🦖</div>
                                    <div className="text-6xl">✊</div>
                                </div>
                            )}
                            {currentQuestion === 2 && (
                                <div className="col-span-2 flex justify-center animate-in fade-in">
                                    <div className="relative w-40 h-40">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted/20" />
                                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-green-500" strokeDasharray={440} strokeDashoffset={44} />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl">90%</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }
    ];

    const currentContent = steps[step];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col md:flex-row animate-in fade-in duration-300 h-screen w-screen overflow-hidden">
            {/* Vidéo source cachée - TOUJOURS MONTÉE pour useCamera */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="hidden"
            />
            {/* Canvas caché pour l'envoi des frames au WebSocket */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Left Side: Visualization (2/3) */}
            <div className="w-full md:w-2/3 h-1/2 md:h-full bg-muted/30 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-border relative overflow-hidden">
                <div className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground/50 font-mono text-sm">
                    <Activity className="w-4 h-4" />
                    <span>{t("visualizationMode")}</span>
                </div>
                {/* Visual Content Wrapper to prevent overflow */}
                <div className="w-full h-full flex items-center justify-center">
                    {currentContent.visual}
                </div>
            </div>

            {/* Right Side: Content (1/3) */}
            <div className="w-full md:w-1/3 h-1/2 md:h-full bg-card p-6 md:p-8 flex flex-col shadow-2xl relative z-10">
                {/* Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-20"
                    onClick={onComplete}
                >
                    <X className="w-5 h-5" />
                </Button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                    <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
                        {t("step")} {step + 1}/{steps.length}
                    </span>
                    {/* Progress Dots */}
                    <div className="flex gap-1.5 ml-auto mr-8">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                    i === step ? "bg-primary scale-125 w-2 h-2" : "bg-muted-foreground/30"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto pr-2 min-h-0 flex flex-col gap-4">
                    <div className="mt-2 flex-shrink-0">
                        {currentContent.icon}
                    </div>

                    <div className="prose dark:prose-invert max-w-none text-l">
                        {currentContent.explanation}
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t gap-2 flex-shrink-0">
                    <Button
                        variant="ghost"
                        onClick={handlePrev}
                        disabled={step === 0}
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t("previous")}
                    </Button>

                    <Button
                        onClick={handleNext}
                        size="default"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 ml-2"
                    >
                        {step === steps.length - 1 ? t("startDinoGame") : t("next")}
                        {step !== steps.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
