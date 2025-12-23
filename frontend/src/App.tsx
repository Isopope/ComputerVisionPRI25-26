import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { LanguageLayout } from "@/components/LanguageLayout";
import { LanguageRedirect } from "@/components/LanguageRedirect";
import Home from "./pages/Home";
import ModeSelection from "./pages/ModeSelection";
import PreGame from "./pages/PreGame";
import ActiveGame from "./pages/ActiveGame";
import DinoGame from "./pages/DinoGame";
import ExplanationSteps from "./pages/ExplanationSteps";
import NotFound from "./pages/NotFound";

const GameRoute = () => {
  const [searchParams] = useSearchParams();
  const game = searchParams.get("game");

  return game === "dino" ? <DinoGame /> : <ActiveGame />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            {/* Root redirects to default language */}
            <Route path="/" element={<LanguageRedirect />} />

            {/* All routes nested under /:lang */}
            <Route path="/:lang" element={<LanguageLayout />}>
              <Route index element={<Home />} />
              <Route path="mode" element={<ModeSelection />} />
              <Route path="pregame" element={<PreGame />} />
              <Route path="game" element={<GameRoute />} />
              <Route path="explanation" element={<ExplanationSteps />} />
            </Route>

            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
