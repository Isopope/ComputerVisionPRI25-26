import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SystemStatus } from "./SystemStatus";
import { useTheme } from "@/hooks/useTheme";

interface HUDFrameProps {
    children: ReactNode;
    className?: string;
}

export const HUDFrame = ({ children, className }: HUDFrameProps) => {
    const { theme } = useTheme();
    const isCyberpunk = theme === "cyberpunk";

    return (
        <div className="fixed inset-0 overflow-hidden flex flex-col">
            {/* Scanline Effect Overlay (Cyberpunk only) */}
            <div className={cn(
                "absolute inset-0 pointer-events-none z-0 opacity-0 transition-opacity duration-1000",
                isCyberpunk && "opacity-[0.03]"
            )}
                style={{
                    backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
                    backgroundSize: "100% 2px, 3px 100%"
                }}
            />

            {/* Top Status Bar */}
            <div className={cn(
                "transition-all duration-700 transform z-50",
                isCyberpunk ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
            )}>
                <SystemStatus />
            </div>

            {/* Main Content Area with Tech Borders */}
            <main className={cn("relative flex-1 flex flex-col items-center justify-center p-6 z-10 transition-colors duration-1000", className)}>
                {/* Corner Decors */}
                {[
                    "top-0 left-0 border-t-2 border-l-2 rounded-tl-3xl",
                    "top-0 right-0 border-t-2 border-r-2 rounded-tr-3xl",
                    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-3xl",
                    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-3xl"
                ].map((pos, i) => (
                    <div key={i} className={cn(
                        "absolute w-32 h-32 border-primary opacity-0 transition-all duration-1000 pointer-events-none",
                        pos,
                        isCyberpunk && "opacity-60"
                    )} />
                ))}

                {/* Decorative Lines */}
                <div className={cn(
                    "absolute top-8 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none transition-opacity duration-1000",
                    isCyberpunk ? "opacity-100" : "opacity-0"
                )} />
                <div className={cn(
                    "absolute bottom-8 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none transition-opacity duration-1000",
                    isCyberpunk ? "opacity-100" : "opacity-0"
                )} />

                {children}
            </main>

            {/* Bottom Status Bar (Simplified) */}
            <div className={cn(
                "w-full h-8 bg-black/50 border-t border-primary/30 flex items-center justify-between px-6 text-[10px] text-muted-foreground font-mono uppercase tracking-widest z-50 transition-all duration-700 transform",
                isCyberpunk ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}>
                <span>COORD: {Math.random().toFixed(4)} / {Math.random().toFixed(4)}</span>
                <span className="animate-pulse">waiting for input...</span>
                <span>VER: 3.14.9</span>
            </div>
        </div>
    );
};
