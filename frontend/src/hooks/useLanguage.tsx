import { createContext, useContext, useState, ReactNode } from "react";

type Language = "fr" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  fr: {
    welcome: "🎉 Bienvenue dans l'Atelier IA Ludique !",
    subtitle: "Joue, découvre l'intelligence artificielle, et défie une IA !",
    startAdventure: "👉 Commencer l'aventure !",
    chooseGame: "🕹️ Choisis ton jeu et ton mode !",
    chooseGameSubtitle: "Chaque jeu propose 3 façons de jouer avec l'IA. À toi de choisir !",
    whereIsCharlie: "🧍 Où est Charlie",
    dobble: "🔍 Dobble",
    dinoRun: "🦖 Dino Run",
    modeAIPure: "🤖 Mode IA Pure",
    modeAIVsHuman: "🧠 Mode IA vs Humain",
    modeExplicatif: "📚 Mode Explicatif",
    descAIPure: "Laisse l'IA te montrer ce qu'elle sait faire !",
    descAIVsHuman: "Défie l'IA en duel !",
    descExplicatif: "Découvre les secrets de l'intelligence artificielle",
    descDinoAIVsHuman: "Contrôle le dinosaure avec tes gestes !",
    descDinoExplicatif: "Comprends comment l'IA détecte tes mouvements",
    launchGame: "✅ Lancer le jeu",
    backHome: "Accueil",
    selectGame: "Sélectionne un jeu pour continuer",
    selectMode: "Choisis un mode de jeu",
    gestureDetected: "Geste détecté",
    handPosition: "Position de la main",
    confidence: "Confiance",
    thresholds: "Seuils de détection",
    finalScore: "Score final",
    replay: "Rejouer",
    home: "Accueil",
    explainProcess: "Explication du processus",
    howDidAIAnalyze: "Comment l'IA a-t-elle analysé ?",
    aiProcessExplanation: "Découvre étape par étape comment l'IA a détecté l'élément",
    step: "Étape",
    next: "Suivant",
    previous: "Précédent",
    finish: "Terminer",
    step1Title: "Pré-traitement de l'image",
    step1Desc: "L'image est redimensionnée et normalisée pour optimiser la détection. Les pixels sont convertis en valeurs numériques que l'IA peut traiter.",
    step2Title: "Extraction des caractéristiques",
    step2Desc: "Un réseau de neurones convolutif (CNN) analyse l'image couche par couche pour détecter les formes, les couleurs et les textures.",
    step3Title: "Détection et localisation",
    step3Desc: "L'IA identifie les éléments dans l'image et calcule leur position exacte avec des boîtes englobantes (bounding boxes).",
    step4Title: "Classification et scoring",
    step4Desc: "Chaque élément détecté reçoit un score de confiance. Seuls les résultats dépassant un seuil minimum sont retenus.",
    step5Title: "Post-traitement",
    step5Desc: "Les détections redondantes sont supprimées et les résultats finaux sont affinés pour garantir la précision maximale.",
    analyzing: "Analyse en cours…",
    analysisComplete: "Analyse terminée !",
    aiSearching: "L'IA cherche l'élément cible…",
    aiFoundElements: "L'IA a trouvé tous les éléments !",
  },
  en: {
    welcome: "🎉 Welcome to the AI Fun Workshop!",
    subtitle: "Play, discover artificial intelligence, and challenge an AI!",
    startAdventure: "👉 Start the adventure!",
    chooseGame: "🕹️ Choose your game and mode!",
    chooseGameSubtitle: "Each game offers 3 ways to play with AI. Your choice!",
    whereIsCharlie: "🧍 Where's Waldo",
    dobble: "🔍 Dobble",
    dinoRun: "🦖 Dino Run",
    modeAIPure: "🤖 Pure AI Mode",
    modeAIVsHuman: "🧠 AI vs Human Mode",
    modeExplicatif: "📚 Explanatory Mode",
    descAIPure: "Let the AI show you what it can do!",
    descAIVsHuman: "Challenge the AI in a duel!",
    descExplicatif: "Discover the secrets of artificial intelligence",
    descDinoAIVsHuman: "Control the dinosaur with your gestures!",
    descDinoExplicatif: "Understand how AI detects your movements",
    launchGame: "✅ Launch game",
    backHome: "Home",
    selectGame: "Select a game to continue",
    selectMode: "Choose a game mode",
    gestureDetected: "Gesture detected",
    handPosition: "Hand position",
    confidence: "Confidence",
    thresholds: "Detection thresholds",
    finalScore: "Final score",
    replay: "Replay",
    home: "Home",
    explainProcess: "Process Explanation",
    howDidAIAnalyze: "How did the AI analyze?",
    aiProcessExplanation: "Discover step by step how the AI detected the element",
    step: "Step",
    next: "Next",
    previous: "Previous",
    finish: "Finish",
    step1Title: "Image Preprocessing",
    step1Desc: "The image is resized and normalized to optimize detection. Pixels are converted into numerical values that the AI can process.",
    step2Title: "Feature Extraction",
    step2Desc: "A Convolutional Neural Network (CNN) analyzes the image layer by layer to detect shapes, colors, and textures.",
    step3Title: "Detection and Localization",
    step3Desc: "The AI identifies elements in the image and calculates their exact position with bounding boxes.",
    step4Title: "Classification and Scoring",
    step4Desc: "Each detected element receives a confidence score. Only results exceeding a minimum threshold are retained.",
    step5Title: "Post-processing",
    step5Desc: "Redundant detections are removed and final results are refined to ensure maximum accuracy.",
    analyzing: "Analyzing…",
    analysisComplete: "Analysis Complete!",
    aiSearching: "The AI is searching for the target element…",
    aiFoundElements: "The AI has found all elements!",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>("fr");

  const t = (key: string): string => {
    return translations[lang][key as keyof typeof translations.fr] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
