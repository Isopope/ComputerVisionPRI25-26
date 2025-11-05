import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface ScorePanelProps {
  score: number;
}

export const ScorePanel = ({ score }: ScorePanelProps) => {
  return (
    <Card className="p-6 bg-card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Score</h3>
        </div>

        <div className="text-center">
          <div className="text-5xl font-bold text-primary">
            {score}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Continue comme ça !
          </p>
        </div>
      </div>
    </Card>
  );
};
