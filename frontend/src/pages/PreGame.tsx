import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Home, Camera, Video, ArrowLeft, Upload, Image } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";

type SubMode = "capture" | "realtime" | "upload" | null;

const PreGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { toast } = useToast();

  const gameFromUrl = searchParams.get("game");
  const modeFromUrl = searchParams.get("mode");
  const [selectedSubMode, setSelectedSubMode] = useState<SubMode>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!gameFromUrl || !modeFromUrl) {
      navigate("/");
    }
  }, [gameFromUrl, modeFromUrl, navigate]);

  // Demander l'accès à la caméra si mode capture sélectionné
  useEffect(() => {
    if (selectedSubMode === "capture" && !stream) {
      startCamera();
    }

    // Nettoyer le stream quand on quitte
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedSubMode]);

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
      }
    }
  };

  const recapture = () => {
    setCapturedImage(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: "Fichier invalide",
        description: "Veuillez sélectionner une image (JPG, PNG, etc.)",
        variant: "destructive",
      });
    }
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLaunch = () => {
    if (selectedSubMode === "capture" && capturedImage) {
      navigate(`/game?game=${gameFromUrl}&mode=${modeFromUrl}&submode=${selectedSubMode}`, {
        state: { capturedImage }
      });
    } else if (selectedSubMode === "upload" && uploadedImage) {
      navigate(`/game?game=${gameFromUrl}&mode=${modeFromUrl}&submode=${selectedSubMode}`, {
        state: { capturedImage: uploadedImage }
      });
    } else if (selectedSubMode === "realtime") {
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

      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {modeFromUrl === "ai-pure" && "🤖 Mode IA Pure – Préparation"}
            {modeFromUrl === "ai-vs-human" && "⚔️ IA vs Humain – Préparation"}
            {modeFromUrl === "explanatory" && "📚 Mode Explicatif – Préparation"}
          </h1>
          <p className="text-base text-muted-foreground">
            {modeFromUrl === "ai-pure" && "Choisis comment l'IA va analyser ton image"}
            {modeFromUrl === "ai-vs-human" && "Prépare le terrain pour défier l'IA"}
            {modeFromUrl === "explanatory" && "Charge une image pour comprendre le processus"}
          </p>
        </div>

        {/* Sub-mode Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            🧠 Choix du sous-mode
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                Prends une photo
              </p>
            </div>

            <div
              onClick={() => setSelectedSubMode("upload")}
              className={`game-card game-card-hover cursor-pointer p-6 flex flex-col items-center gap-4 ${selectedSubMode === "upload" ? "ring-4 ring-primary pulse-ring" : ""
                }`}
            >
              <div className="bg-accent text-accent-foreground p-4 rounded-full">
                <Upload className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-center">
                📁 Upload
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Importe ton image
              </p>
            </div>

            <div
              onClick={() => setSelectedSubMode("realtime")}
              className={`game-card game-card-hover cursor-pointer p-6 flex flex-col items-center gap-4 ${selectedSubMode === "realtime" ? "ring-4 ring-primary pulse-ring" : ""
                }`}
            >
              <div className="bg-secondary text-secondary-foreground p-4 rounded-full rotate-slow">
                <Video className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-center">
                🔄 Temps réel
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Analyse en continu
              </p>
            </div>
          </div>
        </div>

        {/* Camera Preview / Instructions */}
        {selectedSubMode === "capture" ? (
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground p-3 rounded-full">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">
                📷 {capturedImage ? "Image capturée" : "Aperçu caméra"}
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
                  📸 Capturer
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
        ) : selectedSubMode === "upload" ? (
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground p-3 rounded-full">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">
                📁 {uploadedImage ? "Image uploadée" : "Upload ton image"}
              </h3>
            </div>

            {!uploadedImage ? (
              <div
                className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-muted p-6 rounded-full">
                    <Image className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold mb-2">
                      Clique pour sélectionner une image
                    </p>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG, WEBP (max 10 MB)
                    </p>
                  </div>
                  <Button variant="accent" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Parcourir
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-auto max-h-96 object-contain bg-muted" />
                </div>
                <Button
                  variant="secondary"
                  onClick={removeUploadedImage}
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Changer d'image
                </Button>
              </div>
            )}
          </div>
        ) : selectedSubMode === "realtime" ? (
          <div className="game-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground p-3 rounded-full">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">
                📷 Instructions
              </h3>
            </div>
            <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="text-6xl">📱</div>
              <p className="text-center text-sm text-muted-foreground">
                L'IA analysera en temps réel ce qu'elle voit
              </p>
              <div className="flex gap-2 text-3xl">
                🎯 ➡️ 🔄 ➡️ 🤖
              </div>
            </div>
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
            (selectedSubMode === "upload" && !uploadedImage)
          }
          className="w-full"
        >
          ✅ Lancer l'analyse
        </Button>
      </div>
    </div>
  );
};

export default PreGame;
