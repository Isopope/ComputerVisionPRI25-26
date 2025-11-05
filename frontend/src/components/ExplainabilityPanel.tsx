import { Card } from "@/components/ui/card";
import { Brain, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ExplainabilityPanelProps {
  gesture: string;
  confidence: number;
  handPosition?: number;
}

export const ExplainabilityPanel = ({ 
  gesture, 
  confidence, 
  handPosition = 50 
}: ExplainabilityPanelProps) => {
  const getGestureColor = () => {
    switch (gesture) {
      case "jump":
        return "text-green-500";
      case "duck":
        return "text-blue-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getGestureLabel = () => {
    switch (gesture) {
      case "jump":
        return "Saut ✋";
      case "duck":
        return "Accroupi 👇";
      default:
        return "Neutre 🤚";
    }
  };

  return (
    <Card className="p-6 bg-card">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Explicabilité IA</h3>
        </div>

        {/* Gesture Detected */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Geste détecté</p>
          <div className={`text-2xl font-bold ${getGestureColor()}`}>
            {getGestureLabel()}
          </div>
        </div>

        {/* Confidence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Confiance</p>
            <span className="text-sm font-bold text-foreground">
              {Math.round(confidence * 100)}%
            </span>
          </div>
          <Progress value={confidence * 100} className="h-2" />
        </div>

        {/* Hand Position */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Position de la main</p>
          </div>
          <div className="relative h-32 bg-background rounded-lg border border-border p-2">
            <div className="absolute inset-0 flex flex-col justify-between p-2 text-xs text-muted-foreground">
              <span>Haut (Jump)</span>
              <span>Centre</span>
              <span>Bas (Duck)</span>
            </div>
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full transition-all duration-200"
              style={{ top: `${handPosition}%` }}
            />
          </div>
        </div>

        {/* Thresholds */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium">Seuils de détection:</p>
          <ul className="space-y-1 pl-4">
            <li>• Y &lt; 40% → Saut ✋</li>
            <li>• Y &gt; 70% → Accroupi 👇</li>
            <li>• Sinon → Neutre 🤚</li>
          </ul>
        </div>

        {/* Real-time explanation */}
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-sm text-foreground">
            {gesture === "jump" && "🟢 Main levée détectée → Le dino saute !"}
            {gesture === "duck" && "🔵 Main baissée détectée → Le dino s'accroupit !"}
            {gesture === "neutral" && "⚪ Main au centre → Position neutre"}
          </p>
        </div>
      </div>
    </Card>
  );
};
