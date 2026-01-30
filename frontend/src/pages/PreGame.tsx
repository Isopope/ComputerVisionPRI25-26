import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigateWithLang } from "@/hooks/useNavigateWithLang";
import { Home, Camera, Video, ArrowLeft, Loader2 } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { analyzeDobble } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

type SubMode = "capture" | "realtime" | null;

const PreGame = () => {
  const navigate = useNavigateWithLang();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const gameFromUrl = searchParams.get("game");
  const modeFromUrl = searchParams.get("mode");
  const [selectedSubMode, setSelectedSubMode] = useState<SubMode>(modeFromUrl === "explanatory" ? "capture" : null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutation YOLO pour le mode explicatif
  const yoloMutation = useMutation({
    mutationFn: ({ image, game }: { image: string; game: string }) =>
      analyzeDobble(image),
  });

  useEffect(() => {
    if (!gameFromUrl || !modeFromUrl) {
      navigate("/");
    }
  }, [gameFromUrl, modeFromUrl, navigate]);

  // Demander l'accès à la caméra si mode capture sélectionné
  useEffect(() => {
    const isStreamActive = stream?.getTracks().some(track => track.readyState === 'live');

    // Démarrer la caméra seulement si on est en mode capture, qu'il n'y a pas d'image capturée, et que le stream n'est pas actif
    if (selectedSubMode === "capture" && !capturedImage && !isStreamActive) {
      startCamera();
    }

    // Nettoyer le stream quand on quitte ou change de sous-mode
    return () => {
      if (stream && selectedSubMode !== "capture") {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    };
  }, [selectedSubMode, capturedImage]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("API getUserMedia non disponible");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Erreur d'accès à la caméra:", error);
      toast({
        title: "Erreur caméra",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive",
      });
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);

        // Arrêter le flux caméra après capture
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }
  };

  const recapture = () => {
    setCapturedImage(null);
  };



  const handleLaunch = () => {
    if (selectedSubMode === "capture" && capturedImage) {
      // Mode explicatif : analyser et aller directement à l'explication
      if (modeFromUrl === "explanatory") {
        yoloMutation.mutate(
          { image: capturedImage, game: gameFromUrl || "dobble" },
          {
            onSuccess: (data) => {
              navigate(`/explanation?game=${gameFromUrl}&mode=${modeFromUrl}`, {
                state: {
                  yoloResult: data.result,
                  capturedImage: capturedImage
                }
              });
            },
            onError: (error) => {
              console.error("Erreur analyse YOLO:", error);
              toast({
                title: "Erreur d'analyse",
                description: "Impossible d'analyser l'image. Veuillez réessayer.",
                variant: "destructive",
              });
            }
          }
        );
      } else {
        // Autres modes : workflow normal
        navigate(`/game?game=${gameFromUrl}&mode=${modeFromUrl}&submode=${selectedSubMode}`, {
          state: { capturedImage }
        });
      }
    } else {
      navigate(`/game?game=${gameFromUrl}&mode=${modeFromUrl}&submode=${selectedSubMode}`);
    }
  };

  const handleBack = () => {
    navigate(`/mode?game=${gameFromUrl}`);
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
            {modeFromUrl === "ai-pure" && t("aiPurePreparation")}
            {modeFromUrl === "ai-vs-human" && t("aiVsHumanPreparation")}
            {modeFromUrl === "explanatory" && t("explanatoryModePreparation")}
          </h1>
          <p className="text-base text-muted-foreground">
            {modeFromUrl === "ai-pure" && t("aiPurePreparationDesc")}
            {modeFromUrl === "ai-vs-human" && t("aiVsHumanPreparationDesc")}
            {modeFromUrl === "explanatory" && t("explanatoryPreparationDesc")}
          </p>
        </div>

        {/* Sub-mode Selection */}
        {modeFromUrl !== "explanatory" && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              🧠 Choix du sous-mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setSelectedSubMode("capture")}
                className={`game-card game-card-hover cursor-pointer p-6 flex flex-col items-center gap-4 ${selectedSubMode === "capture" ? "ring-4 ring-primary pulse-ring" : ""
                  }`}
              >
                <div className="bg-primary text-primary-foreground p-4 rounded-full">
                  <Camera className="w-12 h-12" />
                </div>
                <h3 className="text-lg font-bold text-center">
                  📸 Capture
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                  {t("takePhoto")}
                </p>
              </div>

              <div
                onClick={() => modeFromUrl !== "ai-vs-human" && setSelectedSubMode("realtime")}
                className={`game-card game-card-hover p-6 flex flex-col items-center gap-4 relative ${modeFromUrl === "ai-vs-human"
                  ? "opacity-50 cursor-not-allowed"
                  : selectedSubMode === "realtime"
                    ? "ring-4 ring-secondary pulse-ring cursor-pointer"
                    : "cursor-pointer"
                  }`}
              >
                <div className={`p-4 rounded-full ${modeFromUrl === "ai-vs-human" ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <Video className="w-12 h-12" />
                </div>
                <h3 className="text-lg font-bold text-center">
                  🎥 {t("realTime")}
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                  {modeFromUrl === "ai-vs-human"
                    ? (lang === "fr"
                      ? "⚡ Impossible ! L'IA répond en <200ms, vous n'avez aucune chance 😅"
                      : "⚡ Impossible! AI responds in <200ms, you have no chance 😅")
                    : t("realTimeDesc")
                  }
                </p>
                {modeFromUrl === "ai-vs-human" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg">
                    <span className="text-4xl">🚫</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Preview / Instructions */}
        {selectedSubMode === "capture" ? (
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground p-3 rounded-full">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">
                📷 {capturedImage ? t("capturedImage") : t("cameraPreview")}
              </h3>
            </div>

            {!capturedImage ? (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto"
                />
                <Button
                  variant="accent"
                  size="lg"
                  onClick={captureImage}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {t("capture")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img src={capturedImage} alt="Captured" className="w-full h-auto" />
                </div>
                <Button
                  variant="secondary"
                  onClick={recapture}
                  className="w-full gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Recapturer
                </Button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : null}

        {/* Launch Button */}
        <Button
          variant="accent"
          size="xl"
          onClick={handleLaunch}
          disabled={
            !selectedSubMode ||
            (selectedSubMode === "capture" && !capturedImage) ||
            yoloMutation.isPending
          }
          className="w-full gap-2"
        >
          {yoloMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {modeFromUrl === "explanatory" ? "Analyse en cours..." : t("launchAnalysis")}
            </>
          ) : (
            t("launchAnalysis")
          )}
        </Button>
      </div>
    </div>
  );
};

export default PreGame;
