import { useCallback, useEffect, useState } from "react";
import { isWorkspaceView, type WorkspaceView } from "../workspace-views.js";


interface WorkspaceLayoutPreferences {
    version: 3;
    libraryWidth: number;
    assistantWidth: number;
    libraryCollapsed: boolean;
    assistantCollapsed: boolean;
    proposalWarningsDismissed: boolean;
    selectedArticleId?: string;
    view: WorkspaceView;
}


function finiteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}


function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function storedPreferences(value: unknown): WorkspaceLayoutPreferences | undefined {
    if (!isRecord(value))
        return undefined;

    const libraryWidth = Math.min(280, Math.max(192, finiteNumber(value.libraryWidth, 208)));
    const assistantWidth = Math.max(320, finiteNumber(value.assistantWidth, 384));
    const libraryCollapsed = value.libraryCollapsed === true;
    const assistantCollapsed = value.assistantCollapsed === true;
    if (value.version === 1)
        return { version: 3, libraryWidth, assistantWidth, libraryCollapsed, assistantCollapsed, proposalWarningsDismissed: false, view: "write" };

    const view = value.view === "publish" ? "write" : value.view;
    if ((value.version !== 2 && value.version !== 3) || !isWorkspaceView(view))
        return undefined;

    return {
        version: 3,
        libraryWidth,
        assistantWidth,
        libraryCollapsed,
        assistantCollapsed,
        proposalWarningsDismissed: value.proposalWarningsDismissed === true,
        view,
        ...(typeof value.selectedArticleId === "string" && value.selectedArticleId.trim() ? { selectedArticleId: value.selectedArticleId } : {}),
    };
}


function migratedPreferences(): WorkspaceLayoutPreferences {
    return {
        version: 3,
        libraryWidth: 208,
        assistantWidth: 384,
        libraryCollapsed: localStorage.getItem("skladno-navigation-collapsed") === "true",
        assistantCollapsed: localStorage.getItem("skladno-assistant-collapsed") === "true",
        proposalWarningsDismissed: false,
        view: "write",
    };
}


export function useWorkspaceLayout() {
    const [preferences, setPreferences] = useState(() => {
        const stored = localStorage.getItem("skladno-workspace-layout");

        if (stored)
            try {
                const parsed = storedPreferences(JSON.parse(stored));
                if (parsed)
                    return parsed;
            } catch {
                // Replace malformed local preferences with the current version.
            }

        const migrated = migratedPreferences();

        localStorage.setItem("skladno-workspace-layout", JSON.stringify(migrated));
        localStorage.removeItem("skladno-navigation-collapsed");
        localStorage.removeItem("skladno-assistant-collapsed");

        return migrated;
    });
    const [focusMode, setFocusMode] = useState(false);

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
        proposalWarningsDismissed: preferences.proposalWarningsDismissed,
        setProposalWarningsDismissed: (proposalWarningsDismissed: boolean) => setPreferences((current) => ({ ...current, proposalWarningsDismissed })),
        libraryWidth: preferences.libraryWidth,
        setLibraryWidth: (libraryWidth: number) => setPreferences((current) => ({ ...current, libraryWidth: Math.min(280, Math.max(192, libraryWidth)) })),
        assistantWidth: preferences.assistantWidth,
        setAssistantWidth: (assistantWidth: number) => setPreferences((current) => ({ ...current, assistantWidth: Math.max(320, assistantWidth) })),
        focusMode,
        setFocusMode,
    };
}


export type WorkspaceLayoutState = ReturnType<typeof useWorkspaceLayout>;
