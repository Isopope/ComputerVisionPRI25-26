import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Component that redirects from root "/" to the default language "/fr".
 * This ensures all routes have a language prefix.
 */
export const LanguageRedirect = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user has a saved language preference
        const savedLang = localStorage.getItem("preferredLang");
        const targetLang = savedLang === "en" ? "en" : "fr"; // Default to French

        // Redirect to language-prefixed home
        navigate(`/${targetLang}`, { replace: true });
    }, [navigate]);

    // Show nothing while redirecting
    return null;
};
