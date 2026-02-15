import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { Search, Gamepad2, Info, X, GraduationCap, User } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import dobbleImage from "@/assets/dobble.png";
import dinoImage from "@/assets/dino.png";
import nhumbertImage from "@/assets/nhumbert.png";
import frayarImage from "@/assets/frayar.png";
import { HUDFrame } from "@/components/hud/HUDFrame";

const Home = () => {
  const navigate = useNavigate();
  const navigateWithLang = useNavigateWithLang();
  const { lang: urlLang } = useParams<{ lang: string }>();
  const { lang, setLang, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);

  const handleStart = () => {
    if (selectedGame) {
      navigateWithLang(`/mode?game=${selectedGame}`);
    }
  };

  const handleLanguageChange = (newLang: "fr" | "en") => {
    setLang(newLang);
    // Update URL to reflect new language
    const currentLang = urlLang || "fr";
    navigate(`/${newLang}`, { replace: true });
  };

  const mainContent = (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground animate-fade-in">
            {t("welcome")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Controls Row: Theme + Language */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Explicit Theme Toggle */}
          <div className="flex bg-muted/30 p-1 rounded-2xl border border-primary/20 backdrop-blur-md shadow-inner">
            <button
              onClick={() => setTheme("modern")}
              className={`px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all duration-300 ${theme === "modern"
                ? "bg-primary text-primary-foreground shadow-lg scale-105"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
            >
              MODERN
            </button>
            <button
              onClick={() => setTheme("cyberpunk")}
              className={`px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all duration-300 ${theme === "cyberpunk"
                ? "bg-primary text-primary-foreground shadow-lg scale-105"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
            >
              CYBERPUNK
            </button>
          </div>

          <LanguageSelector currentLang={lang} onLanguageChange={handleLanguageChange} />
        </div>

        {/* Game Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
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

        {/* Legal Mentions Button */}
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowLegalModal(true)}
            className="gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Info className="w-5 h-5" />
            {lang === "fr" ? "Mentions légales" : "Legal Notices"}
          </Button>
        </div>
      </div>

      {/* Legal Modal */}
      <Dialog open={showLegalModal} onOpenChange={setShowLegalModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Info className="w-6 h-6 text-primary" />
              {lang === "fr" ? "Mentions Légales" : "Legal Notices"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Project Description */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl border">
              <h3 className="font-bold text-lg mb-2">
                {lang === "fr" ? "À propos du projet" : "About the Project"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {lang === "fr"
                  ? "Ce projet est une application web interactive combinant React (Frontend) et FastAPI (Backend) pour proposer des expériences de Vision par Ordinateur. Il s'inscrit dans le cadre du Projet Recherche et Innovation (PRI) qui se déroule au Semestre 9 à Polytech Tours."
                  : "This project is an interactive web application combining React (Frontend) and FastAPI (Backend) to offer Computer Vision experiences. It is part of the Research and Innovation Project (PRI) taking place in Semester 9 at Polytech Tours."
                }
              </p>
            </div>

            {/* Team Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">
                {lang === "fr" ? "Équipe" : "Team"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student */}
                <div className="p-4 bg-card border rounded-xl text-center space-y-3">
                  <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-primary/20">
                    <img
                      src={nhumbertImage}
                      alt="N. Humbert"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-primary">
                      <GraduationCap className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {lang === "fr" ? "Étudiant" : "Student"}
                      </span>
                    </div>
                    <p className="font-bold mt-1">N. Humbert</p>
                    <p className="text-xs text-muted-foreground">DI5 - Polytech Tours</p>
                  </div>
                </div>

                {/* Supervisor */}
                <div className="p-4 bg-card border rounded-xl text-center space-y-3">
                  <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-secondary/20">
                    <img
                      src={frayarImage}
                      alt="F. Rayar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-secondary">
                      <User className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {lang === "fr" ? "Encadrant" : "Supervisor"}
                      </span>
                    </div>
                    <p className="font-bold mt-1">F. Rayar</p>
                    <p className="text-xs text-muted-foreground">Polytech Tours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Copyright */}
            <div className="pt-4 border-t text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                © 2025 Polytech Tours - {lang === "fr" ? "Tous droits réservés" : "All rights reserved"}
              </p>
              <p className="text-xs text-muted-foreground opacity-70">
                {lang === "fr"
                  ? "Projet développé dans le cadre du cursus DI5"
                  : "Project developed as part of the DI5 curriculum"
                }
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return <HUDFrame>{mainContent}</HUDFrame>;
};

export default Home;
