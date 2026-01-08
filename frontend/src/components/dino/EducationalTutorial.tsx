import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Camera, Brain, Activity, Play, Eye, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";

interface GestureData {
    gesture: string;
    raw_gesture?: string;
    confidence: number;
    landmarks?: { x: number; y: number; z: number }[];
}

interface EducationalTutorialProps {
    isOpen: boolean;
    onComplete: () => void;
    gestureData: GestureData;
}

export const EducationalTutorial = ({ isOpen, onComplete, gestureData }: EducationalTutorialProps) => {
    const { t } = useLanguage();
    const [step, setStep] = useState(0); // Restore step state
    // State pour l'étape 4 (Action)
    const [prevActionGesture, setPrevActionGesture] = useState<string>("");
    const [jumpTrigger, setJumpTrigger] = useState(false);
    const [jumpCount, setJumpCount] = useState(0);

    // Détecter le saut (changement de geste) pour l'étape 4
    useEffect(() => {
        if (step !== 3) return; // Seulement actif à l'étape 3 (index 3 = Action)

        const current = gestureData.raw_gesture;
        if (!current || current === "neutral") return;

        if (prevActionGesture && current !== prevActionGesture) {
            // CHANGEMENT DÉTECTÉ = SAUT
            setJumpTrigger(true);
            setJumpCount(c => c + 1);
            setTimeout(() => setJumpTrigger(false), 500);
        }

        setPrevActionGesture(current);
    }, [gestureData, step, prevActionGesture]); // Added prevActionGesture to dep array

    // Si pas ouvert, ne rien rendre
    if (!isOpen) return null;

    const steps = [
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
        {
            title: t("step1Skeleton"),
            icon: <Brain className="w-12 h-12 text-purple-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("handDetection")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("mediaPipeExplanation")}
                    </p>
                    <div className="flex items-center gap-3 text-purple-600 font-bold bg-purple-100 dark:bg-purple-900/20 p-4 rounded-lg">
                        <Brain className="w-6 h-6" />
                        <span>{t("tryMovingHand")}</span>
                    </div>
                </div>
            ),
            visual: (
                <div className="relative w-full h-full bg-black/5 rounded-3xl border-2 border-dashed border-purple-200 flex items-center justify-center overflow-hidden p-8">
                    {gestureData.landmarks && gestureData.landmarks.length > 0 ? (
                        <div className="relative w-full h-full max-w-md aspect-square bg-white dark:bg-black rounded-xl shadow-2xl p-4 transform transition-all duration-75">
                            {/* Visualisation abstraite des landmarks */}
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
                    )}
                </div>
            )
        },
        {
            title: t("step3TrainingTitle"),
            icon: <Brain className="w-12 h-12 text-orange-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">{t("step3TrainingTitle")}</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        {t("step3TrainingDesc")}
                    </p>

                    <div className="space-y-4">
                        <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                            <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                                <Activity className="w-5 h-5" /> {t("trainingVsInference")}
                            </h3>
                            <p className="text-sm">{t("trainingAnalogy")}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center transition-colors text-center", gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "bg-green-100 border-green-500 dark:bg-green-900/20 scale-105" : "bg-card")}>
                                <div className="text-3xl mb-1">✋</div>
                                <span className="font-bold text-sm">{t("classOpen")}</span>
                            </div>
                            <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center transition-colors text-center", gestureData.raw_gesture === "Close" || gestureData.raw_gesture === "Pointer" ? "bg-orange-100 border-orange-500 dark:bg-orange-900/20 scale-105" : "bg-card")}>
                                <div className="text-3xl mb-1">✊</div>
                                <span className="font-bold text-sm">{t("classRest")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            visual: (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-6">
                    {/* Neural Network Visualization */}
                    <div className="bg-card w-full max-w-md p-6 rounded-2xl border shadow-xl flex flex-col items-center gap-4">
                        <div className="text-center mb-2">
                            <div className="font-bold text-lg">{t("neuralNetwork")} (.tflite)</div>
                            <div className="text-xs text-muted-foreground">{t("layersExplanation")}</div>
                        </div>

                        <div className="flex items-center justify-center gap-8 w-full">
                            {/* Inputs (Landmarks) */}
                            <div className="flex flex-col gap-1 justify-center h-32">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                                ))}
                                <div className="text-[10px] text-center mt-1 text-muted-foreground">42 inputs</div>
                            </div>

                            {/* Hidden Layers (Abstract) */}
                            <div className="flex-1 h-32 flex items-center justify-center relative border-x border-dashed border-muted/50 px-4">
                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                    <Activity className="w-24 h-24" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[...Array(9)].map((_, i) => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    ))}
                                </div>
                            </div>

                            {/* Outputs (Classes) */}
                            <div className="flex flex-col gap-4 justify-center">
                                <div className={cn("px-3 py-1 rounded border text-xs font-bold transition-all", gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "bg-green-500 text-white scale-110 shadow-lg" : "bg-muted")}>
                                    OPEN
                                </div>
                                <div className={cn("px-3 py-1 rounded border text-xs font-bold transition-all", gestureData.raw_gesture === "Close" ? "bg-orange-500 text-white scale-110 shadow-lg" : "bg-muted")}>
                                    CLOSE
                                </div>
                            </div>
                        </div>

                        <div className="w-full bg-muted/50 rounded-lg p-3 text-xs text-center border mt-2">
                            <span className="font-bold">✨ {t("frozenModel")} :</span> {t("frozenModelDesc")}
                        </div>
                    </div>
                </div>
            )
        },
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
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full gap-8 w-full max-w-lg">
                    {/* Transition Logic Visualization */}
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

                    {/* Action Trigger */}
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
        <div className="fixed inset-0 z-50 bg-background flex flex-col md:flex-row animate-in fade-in duration-300">
            {/* Left Side: Visualization (Mobile: Top) */}
            <div className="w-full md:w-2/3 h-1/2 md:h-full bg-muted/30 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-border relative overflow-hidden">
                <div className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground/50 font-mono text-sm">
                    <Activity className="w-4 h-4" />
                    <span>{t("visualizationMode")}</span>
                </div>
                {currentContent.visual}
            </div>

            {/* Right Side: Content (Mobile: Bottom) */}
            <div className="w-full md:w-1/3 h-1/2 md:h-full bg-card p-8 md:p-12 flex flex-col justify-between shadow-2xl">
                <div>
                    <div className="flex items-center gap-3 mb-8">
                        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
                            {t("step")} {step + 1}/{steps.length}
                        </span>
                    </div>

                    <div className="mb-6">
                        {currentContent.icon}
                    </div>

                    {currentContent.explanation}
                </div>

                <div className="flex items-center justify-between mt-12 pt-6 border-t">
                    <Button
                        variant="ghost"
                        onClick={handlePrev}
                        disabled={step === 0}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" /> {t("previous")}
                    </Button>

                    <Button
                        onClick={handleNext}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                    >
                        {step === steps.length - 1 ? t("startDinoGame") : t("next")}
                        {step !== steps.length - 1 && <ArrowRight className="w-5 h-5 ml-2" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
