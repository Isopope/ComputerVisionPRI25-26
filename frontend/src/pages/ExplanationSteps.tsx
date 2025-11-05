import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/useLanguage";

const ExplanationSteps = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  const gameFromUrl = searchParams.get("game");
  const modeFromUrl = searchParams.get("mode");
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const steps = [
    {
      icon: "🖼️",
      title: t("step1Title"),
      description: t("step1Desc"),
      visual: "preprocessing"
    },
    {
      icon: "🔍",
      title: t("step2Title"),
      description: t("step2Desc"),
      visual: "features"
    },
    {
      icon: "📍",
      title: t("step3Title"),
      description: t("step3Desc"),
      visual: "detection"
    },
    {
      icon: "🎯",
      title: t("step4Title"),
      description: t("step4Desc"),
      visual: "scoring"
    },
    {
      icon: "✨",
      title: t("step5Title"),
      description: t("step5Desc"),
      visual: "postprocessing"
    }
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    navigate(`/mode?game=${gameFromUrl}`);
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  const renderVisual = (visualType: string) => {
    switch (visualType) {
      case "preprocessing":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-lg p-4 flex flex-col items-center gap-2">
              <div className="text-4xl">📷</div>
              <p className="text-xs text-muted-foreground text-center">Image originale</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 flex flex-col items-center gap-2">
              <div className="text-4xl">🖼️</div>
              <p className="text-xs text-muted-foreground text-center">Image normalisée</p>
            </div>
          </div>
        );
      case "features":
        return (
          <div className="space-y-2">
            <div className="h-8 bg-gradient-to-r from-primary/30 to-primary/60 rounded animate-pulse" />
            <div className="h-8 bg-gradient-to-r from-secondary/30 to-secondary/60 rounded animate-pulse delay-100" />
            <div className="h-8 bg-gradient-to-r from-accent/30 to-accent/60 rounded animate-pulse delay-200" />
            <p className="text-xs text-center text-muted-foreground pt-2">Couches neuronales actives</p>
          </div>
        );
      case "detection":
        return (
          <div className="relative bg-muted rounded-lg h-48 flex items-center justify-center">
            <div className="text-6xl">{gameFromUrl === "charlie" ? "🧍" : "🎯"}</div>
            <div className="absolute top-1/4 left-1/4 w-32 h-32 border-4 border-primary rounded-lg animate-pulse" />
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">
              Détecté ✓
            </div>
          </div>
        );
      case "scoring":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Confiance détection</span>
                <span className="font-bold text-primary">98%</span>
              </div>
              <Progress value={98} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Précision localisation</span>
                <span className="font-bold text-secondary">95%</span>
              </div>
              <Progress value={95} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Seuil minimum</span>
                <span className="font-bold text-muted-foreground">70%</span>
              </div>
              <Progress value={70} className="h-2" />
            </div>
          </div>
        );
      case "postprocessing":
        return (
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="flex items-center gap-4 text-4xl">
              <div className="opacity-30">🎯</div>
              <div className="opacity-30">🎯</div>
              <div>🎯</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="line-through text-muted-foreground">Doublons</span>
              <ArrowRight className="w-4 h-4" />
              <span className="font-bold text-primary">Résultat final</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />
      
      {/* Navigation */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/game?game=${gameFromUrl}&mode=${modeFromUrl}`)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          {t("backHome")}
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            🧠 {t("howDidAIAnalyze")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t("aiProcessExplanation")}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("step")} {currentStep} / {totalSteps}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Step content */}
        <div className="game-card p-8 space-y-6">
          {/* Step header */}
          <div className="flex items-center gap-4">
            <div className="text-6xl">{steps[currentStep - 1].icon}</div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {steps[currentStep - 1].description}
              </p>
            </div>
          </div>

          {/* Visual representation */}
          <div className="border-t border-border pt-6">
            {renderVisual(steps[currentStep - 1].visual)}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between gap-4">
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="gap-2 flex-1 sm:flex-none"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("previous")}
          </Button>

          {currentStep < totalSteps ? (
            <Button
              variant="accent"
              onClick={handleNext}
              className="gap-2 flex-1 sm:flex-none"
            >
              {t("next")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="game"
              onClick={handleFinish}
              className="gap-2 flex-1 sm:flex-none"
            >
              <Check className="w-4 h-4" />
              {t("finish")}
            </Button>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index + 1 === currentStep
                  ? "bg-primary scale-125"
                  : index + 1 < currentStep
                  ? "bg-primary/50"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExplanationSteps;
