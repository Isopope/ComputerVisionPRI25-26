import { useLocation, useNavigate } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { DobbleExplanationSteps } from "@/components/dobble/DobbleExplanationSteps";

const ExplanationSteps = () => {
  const navigateWithLang = useNavigateWithLang();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get YOLO result and captured image from location state
  const yoloResult = location.state?.yoloResult;
  const capturedImage = location.state?.capturedImage;

  const handleClose = () => {
    // Navigate back to the previous page
    navigate(-1);
  };

  // If no data is available, redirect back
  if (!yoloResult || !capturedImage) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6">
        <AnimatedBackground />
        <div className="relative z-10 text-center space-y-4">
          <h1 className="text-2xl font-bold">Aucune donnée disponible</h1>
          <p className="text-muted-foreground">
            Veuillez d'abord analyser une image Dobble
          </p>
          <button
            onClick={() => navigateWithLang("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <DobbleExplanationSteps 
      isOpen={true} 
      onClose={handleClose} 
      yoloResult={yoloResult} 
      capturedImage={capturedImage} 
    />
  );
};

export default ExplanationSteps;
