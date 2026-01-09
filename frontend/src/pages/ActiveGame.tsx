import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { Home, RotateCcw, ArrowRight, HelpCircle, ArrowLeft } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { Progress } from "@/components/ui/progress";
import { BoundingBoxOverlay } from "@/components/BoundingBoxOverlay";
import { useBackendHealth, useYoloDobbleAnalysis } from "@/hooks/useYolo";
import { AIPureMode } from "@/components/game-modes/AIPureMode";
import { AIvsHumanDobbleMode } from "@/components/game-modes/AIvsHumanDobbleMode";

// Symboles pour les cartes Dobble
const DOBBLE_SYMBOLS = ["🌟", "🎯", "🎨", "🎪", "🎮", "🚀", "⚡", "💎", "🔥", "🌈", "🎵", "🎭", "🎲", "🏆", "💫", "🎸", "🎺", "🎻", "🥁", "🎤"];

// Générer une carte Dobble avec 8 symboles
const generateCard = (commonSymbol: string): string[] => {
  const symbols = DOBBLE_SYMBOLS.filter(s => s !== commonSymbol);
  const shuffled = symbols.sort(() => Math.random() - 0.5);
  const card = [commonSymbol, ...shuffled.slice(0, 7)];
  return card.sort(() => Math.random() - 0.5);
};

const ActiveGame = () => {
  const navigate = useNavigateWithLang();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { t } = useLanguage();

  const gameFromUrl = searchParams.get("game");
  const modeFromUrl = searchParams.get("mode");
  const subModeFromUrl = searchParams.get("submode");
  const capturedImageFromState = location.state?.capturedImage;

  // Hooks YOLO - avec ou sans toast selon le mode
  const yoloDobbleMutationWithToast = useYoloDobbleAnalysis({ showToast: true }); // Pour mode IA Pure - Dobble
  const yoloDobbleMutationSilent = useYoloDobbleAnalysis({ showToast: false }); // Pour mode IA vs Humain - Dobble
  const { data: backendHealthy } = useBackendHealth();

  // Sélectionner le bon hook selon le mode et le jeu
  const yoloMutation = gameFromUrl === "dobble"
    ? (modeFromUrl === "ai-vs-human" ? yoloDobbleMutationSilent : yoloDobbleMutationWithToast)
    : yoloDobbleMutationSilent; // Default to Dobble silent or handle error

  // États pour mode IA Pure - YOLO réel
  const [analysisStarted, setAnalysisStarted] = useState(false);

  // États pour mode IA vs Humain (Dobble)
  const [commonSymbol, setCommonSymbol] = useState<string>("");
  const [card1, setCard1] = useState<string[]>([]);
  const [card2, setCard2] = useState<string[]>([]);
  const [aiTime, setAiTime] = useState<number | null>(null);
  const [humanTime, setHumanTime] = useState<number | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [aiDetectedSymbol, setAiDetectedSymbol] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "finished">("waiting");
  const [winner, setWinner] = useState<"ai" | "human" | "tie" | null>(null);
  const [clickedWrongSymbol, setClickedWrongSymbol] = useState(false);


  useEffect(() => {
    // submode is optional for ai-vs-human mode
    if (!gameFromUrl || !modeFromUrl) {
      navigate("/");
    }
    if (modeFromUrl === "ai-pure" && !subModeFromUrl) {
      navigate("/");
    }
  }, [gameFromUrl, modeFromUrl, subModeFromUrl, navigate]);

  // Initialisation mode IA vs Humain
  useEffect(() => {
    if (modeFromUrl === "ai-vs-human" && gameFromUrl === "dobble") {
      startNewRound();
    }
  }, [modeFromUrl, gameFromUrl]);

  // Lancer l'analyse YOLO pour mode IA Pure
  useEffect(() => {
    if (modeFromUrl === "ai-pure" && capturedImageFromState && !analysisStarted && backendHealthy) {
      setAnalysisStarted(true);
      yoloMutation.mutate({
        image: capturedImageFromState,
        confidence_threshold: 0.5,
        draw_boxes: true
      });
    }
  }, [modeFromUrl, capturedImageFromState, analysisStarted, backendHealthy, yoloMutation]);

  // Démarrer un nouveau round pour Dobble
  const startNewRound = () => {
    const symbol = DOBBLE_SYMBOLS[Math.floor(Math.random() * DOBBLE_SYMBOLS.length)];
    setCommonSymbol(symbol);
    setCard1(generateCard(symbol));
    setCard2(generateCard(symbol));
    setAiTime(null);
    setHumanTime(null);
    setAiDetectedSymbol(null);
    setGameStatus("playing");
    setWinner(null);
    setClickedWrongSymbol(false);
    setGameStartTime(Date.now());

    // Simulation IA avec délai aléatoire (1-4 secondes)
    const aiDelay = 1000 + Math.random() * 3000;
    setTimeout(() => {
      const aiElapsed = parseFloat((aiDelay / 1000).toFixed(2));
      setAiTime(aiElapsed);
      setAiDetectedSymbol(symbol);
    }, aiDelay);
  };



  // Gestion du clic humain
  const handleSymbolClick = (symbol: string) => {
    if (gameStatus !== "playing" || humanTime !== null) return;

    const elapsed = parseFloat(((Date.now() - gameStartTime) / 1000).toFixed(2));

    if (symbol !== commonSymbol) {
      setClickedWrongSymbol(true);
      setTimeout(() => setClickedWrongSymbol(false), 500);
      return;
    }

    setHumanTime(elapsed);
    setGameStatus("finished");

    // Déterminer le gagnant
    if (aiTime !== null) {
      if (elapsed < aiTime) {
        setWinner("human");
      } else if (aiTime < elapsed) {
        setWinner("ai");
      } else {
        setWinner("tie");
      }
    } else {
      setWinner("human");
    }
  };

  // Vérifier si l'IA a gagné automatiquement
  useEffect(() => {
    if (aiTime !== null && humanTime === null && gameStatus === "playing") {
      const checkTimer = setTimeout(() => {
        if (humanTime === null && gameStatus === "playing") {
          setGameStatus("finished");
          setWinner("ai");
        }
      }, 500);
      return () => clearTimeout(checkTimer);
    }
  }, [aiTime, humanTime, gameStatus]);

  const handleReplay = () => {
    if (modeFromUrl === "ai-vs-human" && gameFromUrl === "dobble") {
      startNewRound();
    } else {
      // Pour mode IA Pure - relancer l'analyse
      setAnalysisStarted(false);
    }
  };



  // Rendu pour le mode IA vs Humain - Dobble (nouveau composant avec YOLO)
  if (modeFromUrl === "ai-vs-human" && gameFromUrl === "dobble") {
    // Sécurité : ce mode ne fonctionne qu'avec le sous-mode "capture"
    if (subModeFromUrl !== "capture") {
      // Redirection vers l'accueil ou affichage d'erreur
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">{t("modeNotAvailable")}</h1>
            <p className="text-muted-foreground">
              {t("modeRequiresCamera")}
              {t("modeNotSupported").replace("{mode}", subModeFromUrl || "")}
            </p>
            <Button onClick={() => navigate("/")} variant="default">
              {t("backToHome")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <AIvsHumanDobbleMode
        gameFromUrl={gameFromUrl}
        modeFromUrl={modeFromUrl}
        subModeFromUrl={subModeFromUrl}
        capturedImageFromState={capturedImageFromState}
        yoloMutation={yoloMutation}
      />
    );
  }

  // Ancien rendu de simulation Dobble (à supprimer plus tard)
  if (false && modeFromUrl === "ai-vs-human" && gameFromUrl === "dobble_old") {
    return (
      <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
        <AnimatedBackground />

        {/* Navigation */}
        <div className="relative z-10 w-full max-w-6xl mx-auto flex gap-3 mb-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <Home className="w-4 h-4" />
            {t("home")}
          </Button>
        </div>

        {/* Header */}
        <div className="relative z-10 text-center space-y-2 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {t("dobbleDuelBoxTitle")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t("dobbleDuelObjective")}
          </p>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 flex-1">
          {/* Zone principale - Split screen */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Zone IA (haut) */}
            <div className="game-card p-6 flex-1">
              <h2 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                {t("aiZone")}
                {aiTime && <span className="text-sm font-normal">({aiTime}s)</span>}
              </h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {card1.map((symbol, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square flex items-center justify-center text-4xl bg-muted rounded-lg transition-all ${aiDetectedSymbol === symbol ? 'ring-4 ring-primary scale-110' : ''
                      }`}
                  >
                    {symbol}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {card2.slice(0, 4).map((symbol, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square flex items-center justify-center text-4xl bg-muted rounded-lg transition-all ${aiDetectedSymbol === symbol ? 'ring-4 ring-primary scale-110' : ''
                      }`}
                  >
                    {symbol}
                  </div>
                ))}
              </div>
              {aiDetectedSymbol && (
                <div className="mt-4 text-center text-sm font-semibold text-primary">
                  ✅ IA a détecté : {aiDetectedSymbol}
                </div>
              )}
            </div>

            {/* Zone Humain (bas) */}
            <div className={`game-card p-6 flex-1 ${clickedWrongSymbol ? 'animate-shake' : ''}`}>
              <h2 className="text-xl font-bold mb-4 text-secondary flex items-center gap-2">
                {t("yourZone")}
                {humanTime && <span className="text-sm font-normal">({humanTime}s)</span>}
              </h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {card1.map((symbol, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSymbolClick(symbol)}
                    disabled={gameStatus !== "playing" || humanTime !== null}
                    className={`aspect-square flex items-center justify-center text-4xl bg-muted rounded-lg transition-all hover:scale-110 hover:bg-accent disabled:cursor-not-allowed ${humanTime && symbol === commonSymbol ? 'ring-4 ring-secondary scale-110' : ''
                      }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {card2.slice(0, 4).map((symbol, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSymbolClick(symbol)}
                    disabled={gameStatus !== "playing" || humanTime !== null}
                    className={`aspect-square flex items-center justify-center text-4xl bg-muted rounded-lg transition-all hover:scale-110 hover:bg-accent disabled:cursor-not-allowed ${humanTime && symbol === commonSymbol ? 'ring-4 ring-secondary scale-110' : ''
                      }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
              {clickedWrongSymbol && (
                <div className="mt-4 text-center text-sm font-semibold text-destructive">
                  {t("wrongSymbol")}
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="secondary" onClick={handleReplay} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                {t("replay")}
              </Button>
              <Button
                variant="accent"
                onClick={() => navigate(`/mode?game=${gameFromUrl}`)}
                className="gap-2"
              >
                {t("changeMode")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Zone latérale - Résultats */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="game-card p-6 space-y-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                {t("results")}
              </h3>

              {/* Comparatif */}
              {gameStatus === "finished" && (
                <div className="space-y-3">
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <div className="text-center space-y-2">
                      <div className="text-4xl">
                        {winner === "human" ? "🎉" : winner === "ai" ? "🤖" : "🤝"}
                      </div>
                      <p className="font-bold text-lg">
                        {winner === "human" ? t("youWon") : winner === "ai" ? t("aiWon") : t("draw")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span>{t("aiTime")}</span>
                      <span className="font-bold">{aiTime}s</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span>{t("yourTime")}</span>
                      <span className="font-bold">{humanTime || "—"}s</span>
                    </div>
                    {humanTime && aiTime && (
                      <div className="flex justify-between items-center p-3 bg-accent/20 rounded-lg">
                        <span>{t("difference")}</span>
                        <span className="font-bold">{Math.abs(humanTime - aiTime).toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gameStatus === "playing" && (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {aiTime ? t("aiFinished") : t("gameInProgress")}
                  </p>
                </div>
              )}
            </div>

            {/* Info symbole commun */}
            {gameStatus === "finished" && (
              <div className="game-card p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
                <div className="text-center space-y-2">
                  <div className="text-4xl">{commonSymbol}</div>
                  <p className="text-sm font-semibold">{t("commonSymbol")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Rendu pour le mode IA Pure (composant extrait)
  if (modeFromUrl === "ai-pure") {
    return (
      <AIPureMode
        gameFromUrl={gameFromUrl}
        modeFromUrl={modeFromUrl}
        subModeFromUrl={subModeFromUrl}
        capturedImageFromState={capturedImageFromState}
        yoloMutation={yoloMutation}
      />
    );
  }

  // Fallback - retour à l'accueil si mode non reconnu
  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />

      {/* Navigation en haut */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/pregame?game=${gameFromUrl || "dobble"}&mode=${modeFromUrl || "ai-pure"}`)}
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

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Zone principale */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {yoloMutation.isPending ? "🔍 Analyse en cours…" : "✅ Analyse terminée !"}
            </h1>
            <p className="text-base text-muted-foreground">
              {yoloMutation.isPending
                ? "L'IA cherche l'élément cible…"
                : "L'IA a trouvé tous les éléments !"}
            </p>
          </div>

          {/* Zone centrale - Image analysée */}
          <div className="game-card p-6 flex-1 min-h-[400px] relative overflow-hidden">
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center relative">
              {/* Image capturée ou uploadée */}
              {capturedImageFromState ? (
                <img
                  src={capturedImageFromState}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-6xl">{gameFromUrl === "charlie" ? "🧍" : "🎯"}</div>
                </div>
              )}

              {/* Overlay IA - Bounding boxes de YOLO */}
              {!yoloMutation.isPending && yoloMutation.data && capturedImageFromState && (
                <BoundingBoxOverlay
                  image={capturedImageFromState}
                  boundingBoxes={yoloMutation.data.result.bounding_boxes}
                />
              )}

              {/* Heatmap overlay */}
              {yoloMutation.isPending && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 animate-pulse" />
              )}
            </div>

            {/* Annotations */}
            {!yoloMutation.isPending && yoloMutation.data && (
              <div className="absolute top-4 right-4">
                <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                  {gameFromUrl === "charlie" ? t("charlieDetected") : t("commonSymbolDetected")}
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => navigate(`/pregame?game=${gameFromUrl}&mode=${modeFromUrl}`)}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {subModeFromUrl === "capture" ? "Recapturer" : "Changer d'image"}
            </Button>
            <Button
              variant="accent"
              onClick={() => navigate(`/mode?game=${gameFromUrl}`)}
              className="gap-2"
            >
              Passer au mode suivant
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Zone latérale - Résultats IA */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="game-card p-6 space-y-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              📊 Résultats IA
            </h3>

            {/* Score de confiance */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Score de confiance</span>
                <span className="text-primary font-bold">
                  {yoloMutation.data ? Math.round(yoloMutation.data.result.confidence * 100) : 0}%
                </span>
              </div>
              <Progress
                value={yoloMutation.data ? yoloMutation.data.result.confidence * 100 : 0}
                className="h-3"
              />
            </div>

            {/* Temps de traitement */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-semibold">⏱️ Temps de traitement</span>
              <span className="text-lg font-bold text-secondary">
                {yoloMutation.data ? yoloMutation.data.result.processing_time.toFixed(2) : 0}s
              </span>
            </div>

            {/* Détails des détections */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-semibold">🎯 Éléments détectés</span>
                <span className="text-lg font-bold text-accent">
                  {yoloMutation.data ? yoloMutation.data.result.bounding_boxes.length : 0}
                </span>
              </div>

              {yoloMutation.data && yoloMutation.data.result.bounding_boxes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-accent/10 rounded">
                    <span className="text-sm font-medium">📍 Positions trouvées</span>
                    <span className="text-sm font-bold">
                      {yoloMutation.data.result.bounding_boxes.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-accent/10 rounded">
                    <span className="text-sm font-medium">🎯 Meilleure confiance</span>
                    <span className="text-sm font-bold">
                      {Math.round(Math.max(...yoloMutation.data.result.bounding_boxes.map(b => b.confidence)) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton explication */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                if (yoloMutation.data) {
                  navigate(`/explanation?game=${gameFromUrl}&mode=${modeFromUrl}`, {
                    state: {
                      yoloResult: yoloMutation.data.result,
                      image: capturedImageFromState
                    }
                  });
                }
              }}
              disabled={yoloMutation.isPending || !yoloMutation.data}
            >
              <HelpCircle className="w-4 h-4" />
              Explication du processus
            </Button>
          </div>

          {/* Stats supplémentaires */}
          <div className="game-card p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎉</div>
              <p className="text-sm font-semibold">
                {yoloMutation.isPending ? t("analyzing") : t("missionAccomplished")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveGame;
