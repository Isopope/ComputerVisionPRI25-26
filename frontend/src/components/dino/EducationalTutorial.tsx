import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Camera, Brain, Activity, Play, Eye, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

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
            title: "La Vision par Ordinateur",
            icon: <Eye className="w-12 h-12 text-blue-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">Qu'est-ce que c'est ?</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        La <strong>vision par ordinateur</strong> est la capacité d'une machine à "voir".
                        <br /><br />
                        Contrairement à nous, elle ne voit pas une "image", mais une grille de chiffres (pixels).
                        Son but est de trouver du sens dans ces chiffres.
                    </p>
                    <div className="p-4 bg-muted rounded-xl border-l-4 border-blue-500">
                        <p className="font-medium">💡 Analogie :</p>
                        <p className="text-sm mt-1">C'est comme lire une partition de musique : vous voyez des symboles, mais votre cerveau entend la mélodie.</p>
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
            title: "Étape 1 : Le Squelette",
            icon: <Brain className="w-12 h-12 text-purple-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">Détection de la Main</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        Nous utilisons une IA appelée <strong>MediaPipe</strong>.
                        <br /><br />
                        Elle ne regarde pas la couleur de votre peau ou la forme de vos bagues. Elle cherche <strong>21 points précis</strong> (les phalanges, le poignet, le bout des doigts).
                    </p>
                    <div className="flex items-center gap-3 text-purple-600 font-bold bg-purple-100 dark:bg-purple-900/20 p-4 rounded-lg">
                        <Brain className="w-6 h-6" />
                        <span>Essayez de bouger votre main !</span>
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
                                <CheckCircle2 className="w-4 h-4" /> Détecté
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="text-6xl animate-bounce">👋</div>
                            <p className="text-xl font-medium text-muted-foreground">Levez votre main devant la caméra...</p>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: "Étape 2 : La Classification",
            icon: <Brain className="w-12 h-12 text-orange-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">Reconnaissance de Forme</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        L'IA ne mesure pas juste une distance. Elle compare la <strong>forme globale</strong> de main.
                        <br /><br />
                        C'est comme un jeu d'enfant : "Est-ce que cette forme rentre dans la boîte Main Ouverte ou Poing Fermé ?"
                    </p>
                    <div className="space-y-4">
                        <div className={cn("p-4 rounded-xl border flex items-center justify-between transition-colors", gestureData.raw_gesture === "Open" || gestureData.raw_gesture === "OK" ? "bg-green-100 border-green-500 dark:bg-green-900/20 shadow-lg scale-105" : "opacity-40 grayscale")}>
                            <span className="font-bold text-lg">CLASSE : OUVERT</span>
                            <span className="text-4xl">✋</span>
                        </div>
                        <div className={cn("p-4 rounded-xl border flex items-center justify-between transition-colors", gestureData.raw_gesture === "Close" || gestureData.raw_gesture === "Pointer" ? "bg-orange-100 border-orange-500 dark:bg-orange-900/20 shadow-lg scale-105" : "opacity-40 grayscale")}>
                            <span className="font-bold text-lg">CLASSE : REPOS (COURIR)</span>
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
                            <div className="text-xs font-bold bg-green-500 text-white px-2 py-1 rounded">OUVERT</div>
                        </div>

                        <div className={cn("w-32 h-32 rounded-2xl border-4 flex flex-col items-center justify-center transition-all duration-300 bg-card", gestureData.raw_gesture === "Close" ? "border-orange-500 scale-110 shadow-[0_0_30px_rgba(249,115,22,0.3)]" : "border-muted opacity-50")}>
                            <div className="text-5xl mb-2">✊</div>
                            <div className="text-xs font-bold bg-orange-500 text-white px-2 py-1 rounded">REPOS</div>
                        </div>
                    </div>

                    {/* User Hand */}
                    {gestureData.landmarks && gestureData.landmarks.length > 0 ? (
                        <div className="relative w-64 h-64 bg-white dark:bg-black rounded-full shadow-2xl overflow-visible border-4 border-muted flex items-center justify-center">
                            {/* Connecting Line Logic (Visual Only) */}
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
                                INPUT: {gestureData.raw_gesture || "?"}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center animate-pulse text-muted-foreground w-64 h-64 flex items-center justify-center border-4 border-dashed rounded-full">
                            En attente...
                        </div>
                    )}
                </div>
            )
        },
        {
            title: "Étape 3 : L'Action",
            icon: <Play className="w-12 h-12 text-red-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">Le Déclencheur</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        Le jeu ne regarde pas juste la forme, mais le <strong>changement</strong> (Front Montant).
                        <br />
                        Action = <em>État Précédent ≠ État Actuel</em>
                    </p>
                    <div className="p-6 bg-red-100 dark:bg-red-900/20 rounded-xl text-center space-y-2">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">Alternez "Main Ouverte" (Saut) et "Poing Fermé" (Repos) !</p>
                        <div className="text-4xl font-black">{jumpCount} SAUTS</div>
                    </div>
                </div>
            ),
            visual: (
                <div className="flex flex-col items-center justify-center h-full gap-8 w-full max-w-lg">
                    {/* Transition Logic Visualization */}
                    <div className="flex items-center gap-4 w-full justify-between">
                        <div className="bg-card border p-4 rounded-xl flex-1 text-center opacity-70">
                            <div className="text-xs uppercase font-bold text-muted-foreground">AVANT</div>
                            <div className="text-2xl font-bold">{prevActionGesture || "..."}</div>
                        </div>

                        <ArrowRight className={cn("w-8 h-8 transition-all", jumpTrigger ? "text-red-500 scale-150" : "text-muted-foreground")} />

                        <div className="bg-card border p-4 rounded-xl flex-1 text-center">
                            <div className="text-xs uppercase font-bold text-muted-foreground">MAINTENANT</div>
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
                                    <span className="text-4xl font-black">JUMP!!!</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-4xl grayscale opacity-50">🦖</span>
                                    <span className="text-sm font-bold mt-2">EN ATTENTE D'ACTION...</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "Bonus : Confiance de l'IA",
            icon: <Activity className="w-12 h-12 text-teal-500" />,
            explanation: (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold">Score de Confiance</h2>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        L'IA doute parfois. Elle calcule un pourcentage de certitude.
                        <br />
                        Si la confiance est trop basse (ex: {`<`} 60%), on ignore le geste pour éviter les bugs.
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
                            <span className="text-sm text-muted-foreground">CONFIANCE</span>
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
                    <span>VISUALIZATION_MODE: ACTIVE</span>
                </div>
                {currentContent.visual}
            </div>

            {/* Right Side: Content (Mobile: Bottom) */}
            <div className="w-full md:w-1/3 h-1/2 md:h-full bg-card p-8 md:p-12 flex flex-col justify-between shadow-2xl">
                <div>
                    <div className="flex items-center gap-3 mb-8">
                        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
                            Étape {step + 1}/{steps.length}
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
                        <ArrowLeft className="w-5 h-5 mr-2" /> Précédent
                    </Button>

                    <Button
                        onClick={handleNext}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                    >
                        {step === steps.length - 1 ? "COMMENCER LE JEU" : "SUIVANT"}
                        {step !== steps.length - 1 && <ArrowRight className="w-5 h-5 ml-2" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
