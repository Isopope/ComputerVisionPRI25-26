import { useNavigate, useParams } from "react-router-dom";
import { useCallback } from "react";

type Language = "fr" | "en";

/**
 * Custom hook that provides navigation with automatic language prefix preservation.
 * Usage: const navigateWithLang = useNavigateWithLang();
 *        navigateWithLang('/mode?game=dobble');
 * Result: navigates to '/:currentLang/mode?game=dobble'
 */
export const useNavigateWithLang = () => {
    const navigate = useNavigate();
    const { lang } = useParams<{ lang: string }>();

    const navigateWithLang = useCallback(
        (path: string, options?: { replace?: boolean; state?: any }) => {
            // Ensure path starts with /
            const cleanPath = path.startsWith("/") ? path : `/${path}`;

            // Get current language or default to 'fr'
            const currentLang = (lang === "fr" || lang === "en" ? lang : "fr") as Language;

            // Construct full path with language prefix
            const fullPath = `/${currentLang}${cleanPath}`;

            navigate(fullPath, options);
        },
        [navigate, lang]
    );

    return navigateWithLang;
};
