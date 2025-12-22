import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Gamepad2 } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import dobbleImage from "@/assets/dobble.png";
import dinoImage from "@/assets/dino.png";

const Home = () => {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleStart = () => {
    if (selectedGame) {
      navigate(`/mode?game=${selectedGame}`);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground animate-fade-in">
            {t("welcome")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Language Selector */}
        <div className="flex justify-end">
          <LanguageSelector currentLang={lang} onLanguageChange={setLang} />
        </div>

        {/* Game Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <GameCard
            title={t("dobble")}
            image={dobbleImage}
            selected={selectedGame === "dobble"}
            onClick={() => setSelectedGame("dobble")}
            animationClass="floating-animation"
          />
          <GameCard
            title={t("dinoRun")}
            image={dinoImage}
            icon={Gamepad2}
            selected={selectedGame === "dino"}
            onClick={() => setSelectedGame("dino")}
            animationClass="floating-animation"
          />
        </div>

        {/* Start Button */}
        <Button
          variant="game"
          size="xl"
          onClick={handleStart}
          disabled={!selectedGame}
          className="w-full"
        >
          {t("startAdventure")}
        </Button>

        {!selectedGame && (
          <p className="text-sm text-center text-muted-foreground animate-pulse">
            {t("selectGame")}
          </p>
        )}
      </div>
    </div>
  );
};

export default Home;
