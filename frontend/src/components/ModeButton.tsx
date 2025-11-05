import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface ModeButtonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  selected?: boolean;
  onClick?: () => void;
}

export const ModeButton = ({ 
  title, 
  description, 
  icon: Icon, 
  selected = false, 
  onClick 
}: ModeButtonProps) => {
  return (
    <Button
      variant={selected ? "default" : "outline"}
      size="lg"
      onClick={onClick}
      className={cn(
        "w-full h-auto flex-col gap-2 py-6 relative group",
        selected && "ring-2 ring-offset-2 ring-primary"
      )}
    >
      <div className={cn(
        "transition-transform group-hover:scale-110",
        selected && "animate-bounce"
      )}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="flex flex-col gap-1 text-center">
        <span className="font-bold text-base">{title}</span>
        <span className="text-xs opacity-80 font-normal">
          {description}
        </span>
      </div>
    </Button>
  );
};
