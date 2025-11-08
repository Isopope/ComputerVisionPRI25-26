import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Home, RotateCcw, Trophy } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

interface AIvsHumanDobbleModeProps {
  gameFromUrl: string | null;
  modeFromUrl: string | null;
  subModeFromUrl: string | null;
  capturedImageFromState: string | null;
  yoloMutation: any; // Type from useYoloAnalysis
}

type GamePhase = "analyzing" | "waiting_reveal" | "revealed" | "finished";

interface SymbolMatch {
  symbol: string;
  confidence: number;
  location: string; // "card1" ou "card2"
}

export const AIvsHumanDobbleMode = ({
  gameFromUrl,
  modeFromUrl,
  subModeFromUrl,
  capturedImageFromState,
  yoloMutation,
}: AIvsHumanDobbleModeProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // États du jeu
  const [gamePhase, setGamePhase] = useState<GamePhase>("analyzing");
  const [aiDetectionResult, setAiDetectionResult] = useState<any>(null);
  const [aiRevealDelay, setAiRevealDelay] = useState<number>(0);
  const [humanClickAttempts, setHumanClickAttempts] = useState<number>(0);
  const [humanClickTime, setHumanClickTime] = useState<number | null>(null);
  const [humanFoundSymbol, setHumanFoundSymbol] = useState<boolean>(false);
  const [humanClickedSymbol, setHumanClickedSymbol] = useState<string | null>(null);
  const [winner, setWinner] = useState<"human" | "ai" | "tie" | null>(null);
  const [commonSymbol, setCommonSymbol] = useState<string | null>(null);
  
  const gameStartTimeRef = useRef<number>(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialisation : analyse YOLO au montage
  useEffect(() => {
    if (capturedImageFromState && !aiDetectionResult && gamePhase === "analyzing") {
      // Lancer l'analyse YOLO immédiatement
      yoloMutation.mutate(
        { image: capturedImageFromState, game: gameFromUrl },
        {
          onSuccess: (data: any) => {
            // L'analyse est terminée, on démarre le chronomètre maintenant
            const now = Date.now();
            gameStartTimeRef.current = now;
            
            setAiDetectionResult(data.result);
            
            // Extraire le symbole commun depuis les résultats YOLO
            // Pour l'instant, on prend le premier symbole détecté comme "symbole commun"
            // Cela sera amélioré quand le backend implémentera la logique Dobble
            if (data.result.bounding_boxes && data.result.bounding_boxes.length > 0) {
              setCommonSymbol(data.result.bounding_boxes[0]?.label || "🌟");
            }
            
            setGamePhase("waiting_reveal");
            
            // Générer le délai aléatoire 3-5s APRÈS la fin de l'analyse
            const delay = 3000 + Math.random() * 2000;
            setAiRevealDelay(delay);
            
            // Programmer la révélation de l'IA après ce délai
            revealTimeoutRef.current = setTimeout(() => {
              setGamePhase("revealed");
              determineWinner(null, delay);
            }, delay);
          },
          onError: (error: any) => {
            console.error("Erreur analyse YOLO:", error);
          }
        }
      );
    }
  }, [capturedImageFromState, gameFromUrl]);

  // Nettoyer le timeout si le composant est démonté
  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  // Fonction : déterminer le gagnant
  const determineWinner = (clickTime: number | null, delay: number) => {
    // Empêcher les appels multiples
    if (winner !== null) return;
    
    if (clickTime === null) {
      // Humain n'a pas trouvé avant la révélation - L'IA gagne
      setWinner("ai");
    } else {
      const elapsed = clickTime - gameStartTimeRef.current;
      const threshold = delay - 500; // 0.5s avant révélation
      
      if (elapsed < threshold) {
        // Humain a trouvé bien avant le délai
        setWinner("human");
      } else if (elapsed < delay) {
        // Humain a trouvé juste avant le délai (moins de 0.5s d'avance)
        setWinner("tie");
      } else {
        // Humain a trouvé après le délai
        setWinner("ai");
      }
    }
    setGamePhase("finished");
  };

  // Fonction : gérer le clic de l'humain sur l'image
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gamePhase !== "waiting_reveal" || !aiDetectionResult || !imageRef.current) return;
    
    // Calculer la position du clic en pourcentage
    const rect = imageRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setHumanClickAttempts(prev => prev + 1);
    
    // Vérifier si le clic est proche du symbole commun
    // Pour l'instant, on cherche le premier bounding box (symbole commun)
    const aiBox = aiDetectionResult.bounding_boxes[0];
    if (!aiBox) return;
    
    const aiCenterX = aiBox.x + aiBox.width / 2;
    const aiCenterY = aiBox.y + aiBox.height / 2;
    
    // Calculer la distance
    const dx = clickX - aiCenterX;
    const dy = clickY - aiCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Tolérance de 10%
    const tolerance = 10;
    
    if (distance <= tolerance) {
      // Humain a trouvé le symbole ! Annuler le timeout de l'IA
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
      
      const now = Date.now();
      setHumanClickTime(now);
      setHumanFoundSymbol(true);
      setHumanClickedSymbol(aiBox.label || "?");
      setGamePhase("revealed");
      
      // Déterminer le gagnant immédiatement
      determineWinner(now, aiRevealDelay);
    }
    // Pas de feedback sur les clics incorrects (mode silencieux)
  };

  // Fonction : redémarrer le jeu
  const handleRestart = () => {
    setGamePhase("analyzing");
    setAiDetectionResult(null);
    setHumanClickAttempts(0);
    setHumanClickTime(null);
    setHumanFoundSymbol(false);
    setHumanClickedSymbol(null);
    setWinner(null);
    setCommonSymbol(null);
    gameStartTimeRef.current = 0;
    navigate(`/pregame?game=${gameFromUrl}&mode=${modeFromUrl}`);
  };

  return (
    <div className="min-h-screen relative flex flex-col p-6 overflow-hidden">
      <AnimatedBackground />
      
      {/* Navigation */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex gap-3 mb-6">
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
              ⚔️ IA vs Humain - Dobble
            </h1>
            <p className="text-base text-muted-foreground">
              {gamePhase === "analyzing" && "🔍 L'IA analyse les deux cartes..."}
              {gamePhase === "waiting_reveal" && "👆 Trouve le symbole commun avant l'IA !"}
              {gamePhase === "revealed" && winner === "human" && "🎉 Victoire ! Vous avez trouvé le symbole en premier !"}
              {gamePhase === "revealed" && winner === "ai" && "🤖 L'IA a gagné cette fois..."}
              {gamePhase === "revealed" && winner === "tie" && "🤝 Match nul ! Vous étiez très proche !"}
              {gamePhase === "finished" && "🏁 Partie terminée"}
            </p>
          </div>

          {/* Zone centrale - Image interactive (deux cartes côte à côte) */}
          <div className="game-card p-6 flex-1 min-h-[500px] relative overflow-hidden">
            <div 
              className="w-full h-full bg-muted rounded-lg flex items-center justify-center relative cursor-crosshair"
              onClick={handleImageClick}
            >
              {/* Image des deux cartes */}
              {capturedImageFromState ? (
                <img 
                  ref={imageRef}
                  src={capturedImageFromState} 
                  alt="Find Common Symbol" 
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div className="text-6xl">🎴</div>
              )}
              
              {/* Overlay IA en recherche */}
              {gamePhase === "waiting_reveal" && (
                <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-bold animate-pulse flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  🤖 IA cherche...
                </div>
              )}
              
              {/* Révélation de la position du symbole commun */}
              {(gamePhase === "revealed" || gamePhase === "finished") && aiDetectionResult && imageRef.current && (
                <div 
                  className={`absolute border-4 rounded-lg ${
                    humanFoundSymbol 
                      ? "border-green-500 bg-green-500/20" 
                      : "border-red-500 bg-red-500/20"
                  }`}
                  style={{
                    left: `${aiDetectionResult.bounding_boxes[0]?.x}%`,
                    top: `${aiDetectionResult.bounding_boxes[0]?.y}%`,
                    width: `${aiDetectionResult.bounding_boxes[0]?.width}%`,
                    height: `${aiDetectionResult.bounding_boxes[0]?.height}%`,
                  }}
                >
                  <div className={`absolute -top-8 left-0 px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                    humanFoundSymbol 
                      ? "bg-green-500 text-white" 
                      : "bg-red-500 text-white"
                  }`}>
                    {humanFoundSymbol ? "🎯 Ta position" : "🤖 Position IA"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={handleRestart}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle partie
            </Button>
            <Button
              variant="accent"
              onClick={() => navigate(`/mode?game=${gameFromUrl}`)}
              className="gap-2"
            >
              Changer de mode
            </Button>
          </div>
        </div>

        {/* Zone latérale - Statistiques */}
        <div className="w-full lg:w-80 space-y-4">
          {/* Stats de la partie */}
          <div className="game-card p-6 space-y-4">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              📊 Statistiques
            </h3>

            {/* Nombre de tentatives */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-semibold">👆 Clics</span>
              <span className="text-2xl font-bold text-primary">
                {humanClickAttempts}
              </span>
            </div>

            {/* Statut de l'IA */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-semibold">🤖 Statut IA</span>
              <span className="text-sm font-bold text-accent">
                {gamePhase === "analyzing" && "Analyse..."}
                {gamePhase === "waiting_reveal" && "En attente"}
                {(gamePhase === "revealed" || gamePhase === "finished") && "Révélée"}
              </span>
            </div>

            {/* Temps de l'humain */}
            {humanClickTime && (
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-semibold">⏱️ Votre temps</span>
                <span className="text-lg font-bold text-secondary">
                  {((humanClickTime - gameStartTimeRef.current) / 1000).toFixed(2)}s
                </span>
              </div>
            )}

            {/* Temps de révélation de l'IA */}
            {gamePhase === "revealed" || gamePhase === "finished" ? (
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-semibold">⏱️ Temps IA</span>
                <span className="text-lg font-bold text-accent">
                  {(aiRevealDelay / 1000).toFixed(2)}s
                </span>
              </div>
            ) : null}

            {/* Symbole trouvé */}
            {commonSymbol && (
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-semibold">🎯 Symbole commun</span>
                <span className="text-2xl font-bold text-accent">
                  {commonSymbol}
                </span>
              </div>
            )}
          </div>

          {/* Résultat final */}
          {winner && (
            <div className={`game-card p-6 text-center space-y-3 ${
              winner === "human" ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20" :
              winner === "ai" ? "bg-gradient-to-br from-red-500/20 to-rose-500/20" :
              "bg-gradient-to-br from-yellow-500/20 to-orange-500/20"
            }`}>
              <div className="text-6xl">
                {winner === "human" ? "🏆" : winner === "ai" ? "🤖" : "🤝"}
              </div>
              <h3 className="text-2xl font-bold">
                {winner === "human" ? "Victoire !" : winner === "ai" ? "Défaite" : "Match nul !"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {winner === "human" && "Vous avez trouvé le symbole en premier !"}
                {winner === "ai" && "L'IA était plus rapide cette fois..."}
                {winner === "tie" && "Vous étiez très proche de l'IA !"}
              </p>
              
              {/* Détail du symbole trouvé */}
              {humanClickedSymbol && (
                <div className="text-lg font-bold text-primary mt-2">
                  Symbole : {humanClickedSymbol}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {gamePhase === "waiting_reveal" && (
            <div className="game-card p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
              <div className="text-center space-y-2">
                <div className="text-3xl">👆</div>
                <p className="text-sm font-semibold">
                  Clique sur le symbole commun avant que l'IA révèle sa réponse !
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
