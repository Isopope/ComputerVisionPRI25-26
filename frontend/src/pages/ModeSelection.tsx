import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { Home, Bot, Brain, BookOpen, ArrowLeft } from "lucide-react";
import { ModeButton } from "@/components/ModeButton";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

type GameMode = "ai-pure" | "ai-vs-human" | "explanatory" | null;

const ModeSelection = () => {
  const navigate = useNavigateWithLang();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  const gameFromUrl = searchParams.get("game");
  const [selectedMode, setSelectedMode] = useState<GameMode>(null);

  useEffect(() => {
    if (!gameFromUrl) {
      navigate("/");
    }
  }, [gameFromUrl, navigate]);

  const handleLaunch = () => {
    if (gameFromUrl && selectedMode) {
      // For Dino game, go directly to game (no pregame)
      if (gameFromUrl === "dino") {
        navigate(`/game?game=${gameFromUrl}&mode=${selectedMode}`);
        return;
      }

      // Pour tous les autres jeux (Charlie, Dobble), passer par PreGame
      // pour choisir le mode de capture (capture/upload/realtime)
      navigate(`/pregame?game=${gameFromUrl}&mode=${selectedMode}`);
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />

      {/* Navigation en haut */}
      <div className="relative z-10 w-full max-w-lg mx-auto flex gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
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

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {t("chooseGame")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t("chooseGameSubtitle")}
          </p>
        </div>

        {/* Mode Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            🧠 {t("selectMode")}
          </h2>
          <div className="flex flex-col gap-3">
            {gameFromUrl !== "dino" && (
              <ModeButton
                title={t("modeAIPure")}
                description={t("descAIPure")}
                icon={Bot}
                selected={selectedMode === "ai-pure"}
                onClick={() => setSelectedMode("ai-pure")}
              />
            )}
            <ModeButton
              title={gameFromUrl === "dino" ? t("modeGestureControl") : t("modeAIVsHuman")}
              description={gameFromUrl === "dino" ? t("descGestureControl") : t("descAIVsHuman")}
              icon={Brain}
              selected={selectedMode === "ai-vs-human"}
              onClick={() => setSelectedMode("ai-vs-human")}
            />
            <ModeButton
              title={t("modeExplicatif")}
              description={t("descExplicatif")}
              icon={BookOpen}
              selected={selectedMode === "explanatory"}
              onClick={() => setSelectedMode("explanatory")}
            />
          </div>
        </div>

        {/* Launch Button */}
        <Button
          variant="accent"
          size="xl"
          onClick={handleLaunch}
          disabled={!selectedMode}
          className="w-full"
        >
          {t("launchGame")}
        </Button>

        {!selectedMode && (
          <p className="text-sm text-center text-muted-foreground animate-pulse">
            {t("selectMode")}
          </p>
        )}
      </div>
    </div>
  );
};

export default ModeSelection;
