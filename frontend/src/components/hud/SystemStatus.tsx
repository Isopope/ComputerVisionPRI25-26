import { useState, useEffect } from "react";
import { Activity, Wifi, Battery, Clock } from "lucide-react";

export const SystemStatus = () => {
    const [time, setTime] = useState(new Date());
    const [fps, setFps] = useState(60);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        const fpsTimer = setInterval(() => {
            setFps(Math.floor(Math.random() * (62 - 58 + 1) + 58)); // Fake fluctuating FPS
        }, 2000);

        return () => {
            clearInterval(timer);
            clearInterval(fpsTimer);
        };
    }, []);

    return (
        <div className="w-full flex justify-between items-center px-6 py-2 bg-black/50 border-b border-primary/30 backdrop-blur-sm text-xs font-mono text-primary uppercase tracking-widest z-50">
            {/* LEFT: System Info */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-[hsl(var(--accent))]">
                    <Activity className="w-4 h-4" />
                    <span>SYS: ONLINE</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">FPS:</span>
                    <span>{fps}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">MEM:</span>
                    <span>{(Math.random() * 4 + 12).toFixed(1)} GB</span>
                </div>
            </div>

            {/* CENTER: Title / Decorative */}
            <div className="hidden md:flex items-center gap-2 opacity-50">
                <div className="h-1 w-12 bg-primary/50"></div>
                <span>NEURAL LINK V.2.0.4</span>
                <div className="h-1 w-12 bg-primary/50"></div>
            </div>

            {/* RIGHT: Time & Net */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-primary">
                    <Wifi className="w-4 h-4 animate-pulse" />
                    <span>NET: SECURE</span>
                </div>
                <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                    <Battery className="w-4 h-4" />
                    <span>PWR: 98%</span>
                </div>
                <div className="flex items-center gap-2 pl-4 border-l border-primary/30">
                    <Clock className="w-4 h-4" />
                    <span>{time.toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};
