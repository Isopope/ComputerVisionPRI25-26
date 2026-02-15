import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "modern" | "cyberpunk";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem("app-theme");
        return (saved as Theme) || "modern";
    });

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("app-theme", newTheme);
    };

    const toggleTheme = () => {
        setTheme(theme === "modern" ? "cyberpunk" : "modern");
    };

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("theme-modern", "theme-cyberpunk", "dark");
        root.classList.add(`theme-${theme}`);

        // Activer le mode dark uniquement pour Cyberpunk
        if (theme === "cyberpunk") {
            root.classList.add("dark");
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
