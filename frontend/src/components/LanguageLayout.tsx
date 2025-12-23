import { useEffect } from "react";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";

type Language = "fr" | "en";

/**
 * Layout component that synchronizes the URL language parameter with the language context.
 * Validates that the language is either 'fr' or 'en', redirects to '/fr' if invalid.
 */
export const LanguageLayout = () => {
    const { lang: currentLang, setLang } = useLanguage();
    const { lang } = useParams<{ lang: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        // Validate language parameter
        if (lang !== "fr" && lang !== "en") {
            // Invalid language, redirect to French (default)
            navigate("/fr", { replace: true });
            return;
        }

        // Sync URL language with context if different
        if (lang !== currentLang) {
            setLang(lang as Language);
            localStorage.setItem("preferredLang", lang);
        }
    }, [lang, currentLang, setLang, navigate]);

    // Render child routes
    return <Outlet />;
};
