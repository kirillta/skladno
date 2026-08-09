import { useCallback, useEffect, useState } from "react";
import { isWorkspaceView, type WorkspaceView } from "../workspace-views.js";


export function useWorkspaceLayout() {
    const [preferences, setPreferences] = useState(() => {
        const stored = localStorage.getItem("skladno-workspace-layout");

        if (stored)
            try {
                const parsed = JSON.parse(stored) as { version?: number; libraryWidth?: number; assistantWidth?: number; libraryCollapsed?: boolean; assistantCollapsed?: boolean; selectedArticleId?: unknown; view?: unknown };

                if (parsed.version === 2 && isWorkspaceView(parsed.view))
                    return {
                        version: 2,
                        libraryWidth: Math.min(280, Math.max(192, parsed.libraryWidth ?? 208)),
                        assistantWidth: Math.max(320, parsed.assistantWidth ?? 384),
                        libraryCollapsed: parsed.libraryCollapsed ?? false,
                        assistantCollapsed: parsed.assistantCollapsed ?? false,
                        view: parsed.view,
                        ...(typeof parsed.selectedArticleId === "string" && parsed.selectedArticleId.trim() ? { selectedArticleId: parsed.selectedArticleId } : {}),
                    };

                if (parsed.version === 1)
                    return {
                        version: 2,
                        libraryWidth: Math.min(280, Math.max(192, parsed.libraryWidth ?? 208)),
                        assistantWidth: Math.max(320, parsed.assistantWidth ?? 384),
                        libraryCollapsed: parsed.libraryCollapsed ?? false,
                        assistantCollapsed: parsed.assistantCollapsed ?? false,
                        view: "write" as const,
                    };
            } catch {
                // Replace malformed local preferences with the current version.
            }

        const migrated = { version: 2,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: localStorage.getItem("skladno-navigation-collapsed") === "true",
            assistantCollapsed: localStorage.getItem("skladno-assistant-collapsed") === "true",
            view: "write" as const
        };

        localStorage.setItem("skladno-workspace-layout", JSON.stringify(migrated));
        localStorage.removeItem("skladno-navigation-collapsed");
        localStorage.removeItem("skladno-assistant-collapsed");

        return migrated;
    });
    const [focusMode, setFocusMode] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState("es");

    const setView = useCallback((view: WorkspaceView) => setPreferences((current) => ({ ...current, view })), []);
    const setSelectedArticleId = useCallback((selectedArticleId: string | undefined) => setPreferences((current) => ({ ...current, ...(selectedArticleId ? { selectedArticleId } : { selectedArticleId: undefined }) })), []);

    useEffect(() => localStorage.setItem("skladno-workspace-layout", JSON.stringify(preferences)), [preferences]);

    return {
        view: preferences.view,
        setView,
        selectedArticleId: preferences.selectedArticleId,
        setSelectedArticleId,
        libraryCollapsed: preferences.libraryCollapsed,
        setLibraryCollapsed: (libraryCollapsed: boolean) => setPreferences((current) => ({ ...current, libraryCollapsed })),
        assistantCollapsed: preferences.assistantCollapsed,
        setAssistantCollapsed: (assistantCollapsed: boolean) => setPreferences((current) => ({ ...current, assistantCollapsed })),
        libraryWidth: preferences.libraryWidth,
        setLibraryWidth: (libraryWidth: number) => setPreferences((current) => ({ ...current, libraryWidth: Math.min(280, Math.max(192, libraryWidth)) })),
        assistantWidth: preferences.assistantWidth,
        setAssistantWidth: (assistantWidth: number) => setPreferences((current) => ({ ...current, assistantWidth: Math.max(320, assistantWidth) })),
        focusMode,
        setFocusMode,
        targetLanguage,
        setTargetLanguage,
    };
}
