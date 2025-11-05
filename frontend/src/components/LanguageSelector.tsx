import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  currentLang: "fr" | "en";
  onLanguageChange: (lang: "fr" | "en") => void;
}

export const LanguageSelector = ({ currentLang, onLanguageChange }: LanguageSelectorProps) => {
  return (
    <div className="flex gap-2">
      <Button
        variant={currentLang === "fr" ? "default" : "outline"}
        size="icon"
        onClick={() => onLanguageChange("fr")}
        className={cn(
          "rounded-full w-12 h-12 text-2xl hover:scale-110 transition-transform",
          currentLang === "fr" && "ring-2 ring-offset-2 ring-primary"
        )}
        title="Français"
      >
        🇫🇷
      </Button>
      <Button
        variant={currentLang === "en" ? "default" : "outline"}
        size="icon"
        onClick={() => onLanguageChange("en")}
        className={cn(
          "rounded-full w-12 h-12 text-2xl hover:scale-110 transition-transform",
          currentLang === "en" && "ring-2 ring-offset-2 ring-primary"
        )}
        title="English"
      >
        🇬🇧
      </Button>
    </div>
  );
};
