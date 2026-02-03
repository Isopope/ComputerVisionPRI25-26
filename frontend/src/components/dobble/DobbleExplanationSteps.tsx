import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Camera, Brain, Filter, BarChart3, GitMerge, CheckCircle2, X, Eye, Sparkles, Trophy, Play, Star, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { Slider } from "@/components/ui/slider";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

interface DetectionDetailed {
  classe: string;
  confiance: number;
  bbox: [number, number, number, number];
  bbox_percent?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface YoloResult {
  label: string;
  confidence: number;
  processing_time: number;
  annotated_image: string;
  bounding_boxes: BoundingBox[];
  detections_detailed: DetectionDetailed[];
  classes_detected: string[];
}

interface DobbleExplanationStepsProps {
  isOpen: boolean;
  onClose: () => void;
  yoloResult: YoloResult;
  capturedImage: string;
}

export const DobbleExplanationSteps = ({
  isOpen,
  onClose,
  yoloResult,
  capturedImage
}: DobbleExplanationStepsProps) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3);
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const STEPS_COUNT = 8;

  // Quiz State
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Filter detections by current threshold for step 3
  const filteredDetections = yoloResult.detections_detailed?.filter(
    det => det.confiance >= confidenceThreshold
  ) || [];

  // Count symbols for step 4
  const symbolCounts = yoloResult.detections_detailed?.reduce((acc, det) => {
    acc[det.classe] = (acc[det.classe] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Find duplicate (common symbol)
  const commonSymbol = Object.entries(symbolCounts).find(([_, count]) => count === 2)?.[0] || "";

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  // Trigger animation for step 5
  useEffect(() => {
    if (step === 4) {
      setTimeout(() => setShowMatchAnimation(true), 500);
    } else {
      setShowMatchAnimation(false);
    }
  }, [step]);

  if (!isOpen) return null;

  // Quiz questions for Dobble
  const questions = [
    {
      q: t("dobbleQ1"),
      options: [t("dobbleQ1_opt1"), t("dobbleQ1_opt2"), t("dobbleQ1_opt3")],
      correct: 1
    },
    {
      q: t("dobbleQ2"),
      options: [t("dobbleQ2_opt1"), t("dobbleQ2_opt2"), t("dobbleQ2_opt3")],
      correct: 0
    },
    {
      q: t("dobbleQ3"),
      options: [t("dobbleQ3_opt1"), t("dobbleQ3_opt2"), t("dobbleQ3_opt3")],
      correct: 2
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

  const handleNext = () => {
    if (step < STEPS_COUNT - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const steps = [
    // STEP 0: IMAGE ORIGINALE
    {
      title: t("dobbleStep0Title"),
      icon: <Camera className="w-12 h-12 text-blue-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">📷 {t("dobbleStep0Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep0Desc")}
          </p>
          <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-xl border border-blue-200">
            <p className="font-medium">💡 {t("dobbleStep0Details")}</p>
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
          <div className="relative max-w-2xl w-full bg-muted rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-200">
            <img
              src={capturedImage}
              alt="Captured Dobble Cards"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4" /> Image Source
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-mono">
              Prêt pour l'analyse YOLO →
            </p>
          </div>
        </div>
      )
    },

    // STEP 1: YOLO DETECTION
    {
      title: t("dobbleStep1Title"),
      icon: <Brain className="w-12 h-12 text-purple-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">🧠 {t("dobbleStep1Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep1Desc")}
          </p>
          <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-xl border border-purple-200 space-y-2">
            <div className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <Brain className="w-5 h-5" /> {yoloResult.detections_detailed?.length || 0} {t("dobbleStep3TotalSymbols")}
            </div>
            <p className="text-sm">{t("processingTime")} {yoloResult.processing_time.toFixed(3)}s</p>
          </div>

          {/* NOUVEAU : Qu'est-ce que YOLO */}
          <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border-l-4 border-purple-500 space-y-2">
            <h3 className="font-bold text-purple-800 dark:text-purple-400">
              {t("whatIsYOLO")}
            </h3>
            <p className="text-sm font-mono text-purple-700 dark:text-purple-300">
              {t("yoloFullName")}
            </p>
            <p className="text-sm text-purple-900 dark:text-purple-200 leading-relaxed">
              {t("yoloDetail")}
            </p>
          </div>

          {/* NOUVEAU : Comment ça fonctionne */}
          <div className="p-4 bg-muted/50 rounded-xl space-y-2">
            <h3 className="font-bold flex items-center gap-2">
              {t("howYOLOWorks")}
            </h3>
            <p className="text-sm leading-relaxed">
              {t("yoloWorkflow")}
            </p>
          </div>

          {/* NOUVEAU : Comment c'est entraîné */}
          <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800 space-y-2">
            <h3 className="font-bold text-green-800 dark:text-green-400">
              {t("howYOLOTrained")}
            </h3>
            <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed">
              {t("yoloTrainingExplain")}
            </p>
            <div className="text-xs font-mono bg-white/50 dark:bg-black/20 p-2 rounded text-center text-green-700 dark:text-green-300">
              {t("yoloOurModel")}
            </div>
          </div>

          <div className="p-4 bg-muted rounded-xl">
            <h4 className="font-bold text-sm mb-2">{t("dobbleStep1Details")}</h4>
            <div className="max-h-32 overflow-y-auto font-mono text-xs space-y-1">
              {yoloResult.detections_detailed?.slice(0, 8).map((det, i) => (
                <div key={i} className="flex justify-between">
                  <span>{det.classe}</span>
                  <span className="text-primary">{(det.confiance * 100).toFixed(0)}%</span>
                </div>
              ))}
              {yoloResult.detections_detailed && yoloResult.detections_detailed.length > 8 && (
                <div className="text-center text-muted-foreground">...</div>
              )}
            </div>
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8 w-full">
          <div className="relative max-w-2xl w-full bg-muted rounded-2xl overflow-hidden border-2 border-purple-200">
            <img
              src={capturedImage}
              alt="YOLO Processing"
              className="w-full h-full object-contain opacity-90"
            />
            {/* Show all detections as small dots */}
            {yoloResult.detections_detailed?.map((det, index) => {
              // Les coordonnées bbox_percent sont déjà en pourcentage (0-100)
              // Si bbox_percent n'existe pas, on le calcule depuis bbox (pixels absolus)
              const bbox = det.bbox_percent || {
                x: (det.bbox[0] / 640) * 100,
                y: (det.bbox[1] / 640) * 100,  // Assuming square image
                width: ((det.bbox[2] - det.bbox[0]) / 640) * 100,
                height: ((det.bbox[3] - det.bbox[1]) / 640) * 100
              };
              return (
                <div
                  key={index}
                  className="absolute border-2 border-purple-500 rounded-lg animate-pulse"
                  style={{
                    left: `${bbox.x}%`,
                    top: `${bbox.y}%`,
                    width: `${bbox.width}%`,
                    height: `${bbox.height}%`,
                  }}
                />
              );
            })}
            <div className="absolute top-4 left-4 bg-purple-500/90 text-white px-4 py-2 rounded-full text-sm font-bold animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              🤖 {t("dobbleStep1Analyzing")}
            </div>
          </div>
        </div>
      )
    },

    // STEP 2: FILTRAGE
    {
      title: t("dobbleStep2Title"),
      icon: <Filter className="w-12 h-12 text-pink-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">🎯 {t("dobbleStep2Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep2Desc")}
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-pink-100 dark:bg-pink-900/20 rounded-xl border border-pink-200">
              <p className="font-bold text-pink-700 dark:text-pink-400 mb-2">
                {t("dobbleStep2ConfidenceThreshold")} {(confidenceThreshold * 100).toFixed(0)}%
              </p>
              <Slider
                value={[confidenceThreshold]}
                onValueChange={(val) => setConfidenceThreshold(val[0])}
                min={0.1}
                max={0.9}
                step={0.05}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>{t("dobbleStep2InitialDetections")}</span>
              <span className="font-bold">{yoloResult.detections_detailed?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t("dobbleStep2AfterFiltering")}</span>
              <span className="font-bold text-pink-600">{filteredDetections.length}</span>
            </div>
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8 w-full">
          {/* Image avec bounding boxes filtrées */}
          <div className="relative max-w-2xl w-full bg-muted rounded-2xl overflow-hidden border-2 border-pink-200">
            <img
              src={capturedImage}
              alt="Confidence Filtering"
              className="w-full h-full object-contain"
            />
            {/* Afficher seulement les détections au-dessus du seuil */}
            {yoloResult.detections_detailed?.map((det, index) => {
              if (det.confiance < confidenceThreshold) return null;

              const bbox = det.bbox_percent || {
                x: (det.bbox[0] / 640) * 100,
                y: (det.bbox[1] / 640) * 100,
                width: ((det.bbox[2] - det.bbox[0]) / 640) * 100,
                height: ((det.bbox[3] - det.bbox[1]) / 640) * 100
              };

              return (
                <div
                  key={index}
                  className="absolute border-4 border-green-500 rounded-lg bg-green-500/20 transition-all duration-300 shadow-lg"
                  style={{
                    left: `${bbox.x}%`,
                    top: `${bbox.y}%`,
                    width: `${bbox.width}%`,
                    height: `${bbox.height}%`,
                    boxShadow: "0 0 15px rgba(34, 197, 94, 0.5)"
                  }}
                >
                  <div className="absolute -top-7 left-0 bg-green-500 text-white px-3 py-1 rounded font-bold whitespace-nowrap text-sm shadow-lg">
                    {det.classe} {(det.confiance * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}

            {/* Badge du nombre de détections visibles */}
            <div className="absolute top-4 left-4 bg-pink-500/90 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {filteredDetections.length} / {yoloResult.detections_detailed?.length || 0}
            </div>
          </div>

          {/* Stats en dessous */}
          <div className="flex gap-4 text-sm">
            <div className="px-4 py-2 bg-muted rounded-lg">
              <span className="text-muted-foreground">Seuil : </span>
              <span className="font-bold text-pink-600">{(confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <div className="px-4 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-200">
              <span className="text-muted-foreground">Retenues : </span>
              <span className="font-bold text-green-600">{filteredDetections.length}</span>
            </div>
          </div>
        </div>
      )
    },

    // STEP 3: COMPTAGE
    {
      title: t("dobbleStep3Title"),
      icon: <BarChart3 className="w-12 h-12 text-orange-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">📊 {t("dobbleStep3Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep3Desc")}
          </p>
          <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-xl border border-orange-200 space-y-2">
            <div className="flex justify-between">
              <span className="font-bold">{t("dobbleStep3TotalSymbols")}</span>
              <span className="text-2xl font-black text-orange-600">{Object.keys(symbolCounts).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">{t("dobbleStep3DuplicateSymbols")}</span>
              <span className="text-2xl font-black text-green-600">
                {Object.values(symbolCounts).filter(c => c === 2).length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(symbolCounts).map(([symbol, count]) => (
              <div key={symbol} className={cn(
                "flex justify-between p-2 rounded",
                count === 2 ? "bg-green-100 dark:bg-green-900/20 font-bold" : "bg-muted"
              )}>
                <span>{symbol}</span>
                <span>{count}x</span>
              </div>
            ))}
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-8 p-8 w-full max-w-3xl">
          <h3 className="text-2xl font-bold">{t("dobbleStep3OccurrencesChart")}</h3>
          <div className="w-full space-y-3">
            {Object.entries(symbolCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([symbol, count]) => (
                <div key={symbol} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-mono">{symbol}</span>
                    <span className={cn(
                      "font-bold",
                      count === 2 ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {count}x
                    </span>
                  </div>
                  <div className="w-full h-8 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 flex items-center justify-center text-white font-bold text-sm",
                        count === 2 ? "bg-green-500 animate-pulse" : "bg-orange-500"
                      )}
                      style={{ width: `${(count / 2) * 100}%` }}
                    >
                      {count === 2 && "✓ Trouvé !"}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )
    },

    // STEP 4: MATCHING (Venn Diagram)
    {
      title: t("dobbleStep4Title"),
      icon: <GitMerge className="w-12 h-12 text-teal-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">✨ {t("dobbleStep4Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep4Desc")}
          </p>
          <div className="p-6 bg-teal-100 dark:bg-teal-900/20 rounded-xl border border-teal-200 text-center space-y-2">
            <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{t("dobbleStep4CommonFound")}</p>
            <div className="text-5xl font-black">{commonSymbol}</div>
            <p className="text-xs text-muted-foreground">{t("processingTime")} {yoloResult.processing_time.toFixed(2)}s</p>
          </div>
        </div>
      ),
      visual: (
        <div className="flex items-center justify-center h-full gap-12 p-8">
          <div className={cn(
            "w-64 h-64 rounded-full bg-blue-500/20 border-4 border-blue-500 flex items-center justify-center transition-all duration-1000",
            showMatchAnimation && "scale-110"
          )}>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{t("dobbleStep4Card1")}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {Object.keys(symbolCounts).filter(s => symbolCounts[s] >= 1).slice(0, 4).join(" ")}
              </div>
            </div>
          </div>

          <div className={cn(
            "absolute w-48 h-48 rounded-full bg-green-500/30 border-4 border-green-500 flex items-center justify-center transition-all duration-1000 z-10",
            showMatchAnimation ? "scale-150 opacity-100" : "scale-0 opacity-0"
          )}>
            <div className="text-6xl animate-bounce">{commonSymbol}</div>
          </div>

          <div className={cn(
            "w-64 h-64 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center transition-all duration-1000",
            showMatchAnimation && "scale-110"
          )}>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{t("dobbleStep4Card2")}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {Object.keys(symbolCounts).filter(s => symbolCounts[s] >= 1).slice(4, 8).join(" ")}
              </div>
            </div>
          </div>
        </div>
      )
    },

    // STEP 5: BOUNDING BOXES
    {
      title: t("dobbleStep5Title"),
      icon: <Eye className="w-12 h-12 text-indigo-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">🎯 {t("dobbleStep5Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep5Desc")}
          </p>
          <div className="space-y-3">
            {yoloResult.bounding_boxes.map((box, i) => (
              <div key={i} className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg border border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold">{box.label}</span>
                  <span className="text-sm text-indigo-600">{(box.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  Position: ({box.x.toFixed(1)}%, {box.y.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8 w-full">
          <div className="relative max-w-2xl w-full bg-muted rounded-2xl overflow-hidden border-2 border-indigo-200">
            <img
              src={capturedImage}
              alt="Final Result"
              className="w-full h-full object-contain"
            />
            {yoloResult.bounding_boxes.map((box, index) => (
              <div
                key={index}
                className="absolute border-4 border-green-500 rounded-lg bg-green-500/20 animate-pulse"
                style={{
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                }}
              >
                <div className="absolute -top-8 left-0 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                  {box.label} {(box.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">✓ Symbole commun localisé</p>
          </div>
        </div>
      )
    },

    // STEP 6: PERFORMANCE
    {
      title: t("dobbleStep6Title"),
      icon: <Sparkles className="w-12 h-12 text-yellow-500" />,
      explanation: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">⚡ {t("dobbleStep6Subtitle")}</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("dobbleStep6Desc")}
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg flex justify-between">
              <span>{t("dobbleStep6TotalDetections")}</span>
              <span className="font-bold">{yoloResult.detections_detailed?.length || 0}</span>
            </div>
            <div className="p-3 bg-muted rounded-lg flex justify-between">
              <span>{t("dobbleStep2AfterFiltering")}</span>
              <span className="font-bold text-primary">{filteredDetections.length}</span>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg flex justify-between border border-green-200">
              <span>{t("commonSymbol")}</span>
              <span className="font-bold text-green-600">{commonSymbol}</span>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex justify-between border border-yellow-200">
              <span>{t("dobbleStep6ProcessingTime")}</span>
              <span className="font-bold text-yellow-600">{yoloResult.processing_time.toFixed(3)}s</span>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex justify-between border border-blue-200">
              <span>{t("dobbleStep6FinalConfidence")}</span>
              <span className="font-bold text-blue-600">{(yoloResult.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="p-4 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 text-center">
            <p className="text-lg font-bold">🎉 {t("dobbleStep6Success")}</p>
          </div>
        </div>
      ),
      visual: (
        <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
          <div className="text-center space-y-4">
            <div className="text-8xl">🎯</div>
            <h3 className="text-3xl font-black">{commonSymbol}</h3>
            <p className="text-xl text-muted-foreground">{t("dobbleStep6CommonSymbolLabel")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-card border rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{yoloResult.detections_detailed?.length || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">{t("detectedElements")}</div>
            </div>
            <div className="bg-card border rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{(yoloResult.processing_time * 1000).toFixed(0)}ms</div>
              <div className="text-xs text-muted-foreground mt-1">{t("processingTime")}</div>
            </div>
            <div className="bg-card border rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{(yoloResult.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground mt-1">{t("confidence")}</div>
            </div>
            <div className="bg-card border rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">2</div>
              <div className="text-xs text-muted-foreground mt-1">{t("dobbleStep3Subtitle")}</div>
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
                {t("dobbleQuizIntro")}
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
              <p className="text-center text-muted-foreground text-sm leading-relaxed">
                {t("quizThanks")}
              </p>
              <Button onClick={onClose} variant="outline" className="w-full">
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
            <div className="flex flex-col items-center gap-8 w-full max-w-lg p-4">
              {/* Visual hint based on question */}
              {currentQuestion === 0 && (
                <div className="animate-in fade-in flex flex-col items-center gap-4">
                  <div className="text-6xl">🔍</div>
                  <p className="text-muted-foreground text-center">YOLO = You Only Look Once</p>
                </div>
              )}
              {currentQuestion === 1 && (
                <div className="animate-in fade-in flex items-center gap-4">
                  <div className="p-4 bg-green-500/20 border-4 border-green-500 rounded-lg">
                    <span className="text-4xl">🎯</span>
                  </div>
                  <span className="text-2xl">→</span>
                  <div className="text-4xl font-bold text-green-600">85%</div>
                </div>
              )}
              {currentQuestion === 2 && (
                <div className="animate-in fade-in flex flex-col items-center gap-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center text-2xl">🌟⚡🎈</div>
                    <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-2xl">🎈🔥💎</div>
                  </div>
                  <div className="text-4xl animate-bounce">🎈</div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
  ];

  const currentContent = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col md:flex-row animate-in fade-in duration-300 h-screen w-screen overflow-hidden">
      {/* Left Side: Visualization (2/3) */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full bg-muted/30 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-border relative overflow-hidden">
        <div className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground/50 font-mono text-sm">
          <Eye className="w-4 h-4" />
          <span>Mode Explicabilité</span>
        </div>
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
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
            Étape {step + 1}/{STEPS_COUNT}
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
            Précédent
          </Button>

          <Button
            onClick={handleNext}
            size="default"
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 ml-2"
          >
            {step === STEPS_COUNT - 1 ? "Terminer" : "Suivant"}
            {step !== STEPS_COUNT - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
