import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameCardProps {
  title: string;
  image: string;
  icon?: LucideIcon;
  selected?: boolean;
  onClick?: () => void;
  animationClass?: string;
}

export const GameCard = ({ 
  title, 
  image, 
  icon: Icon, 
  selected = false, 
  onClick,
  animationClass = ""
}: GameCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "game-card game-card-hover cursor-pointer p-6 flex flex-col items-center gap-4 relative overflow-hidden",
        selected && "ring-4 ring-primary pulse-ring",
        animationClass
      )}
    >
      <div className="relative w-full aspect-square max-w-[200px]">
        <img 
          src={image} 
          alt={title}
          className={cn(
            "w-full h-full object-contain rounded-lg",
            selected && "scale-110"
          )}
        />
        {Icon && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground p-2 rounded-full animate-bounce">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      <h3 className="text-xl font-bold text-foreground text-center">
        {title}
      </h3>
    </div>
  );
};
