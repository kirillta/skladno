import { useEffect, useLayoutEffect, useState } from "react";
import type { EditorialWorkspaceClient } from "./application/client.js";
import { createRendererApplicationClient, getDesktopShellClient, getDesktopUpdateClient } from "./application/desktop-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";
import { I18nProvider } from "./i18n/I18nProvider.js";
import { NotificationProvider } from "./notifications/NotificationProvider.js";
import { useKeyBindingDispatcher } from "./key-bindings/KeyBindingProvider.js";
import { saveScheduledWebBackup } from "./settings/web-backups.js";
import type { SettingsSection } from "./settings/settings-sections.js";
import { QuickStartDialog } from "./application/QuickStartDialog.js";
import { desktopShellCommands, resolveTheme, type KeyBindingOverrides, type ResolvedTheme, type ThemePreference } from "@skladno/shared";

const defaultClient = createRendererApplicationClient();
const quickStartCompletionKey = "skladno.quick-start.v1";


function readSystemTheme(): ResolvedTheme {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}


function useThemeAppearance(theme: ThemePreference): void {
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia)
            return;

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const update = () => setSystemTheme(media.matches ? "dark" : "light");
        media.addEventListener?.("change", update);

        return () => media.removeEventListener?.("change", update);
    }, []);

    useLayoutEffect(() => {
        const resolved = resolveTheme(theme, systemTheme);
        document.documentElement.dataset.theme = resolved;
        document.documentElement.style.colorScheme = resolved;
    }, [systemTheme, theme]);
}


export function App({ client = defaultClient }: { client?: EditorialWorkspaceClient }) {
    const [screen, setScreen] = useState<"editorial-workspace" | "application-settings">("editorial-workspace");
    const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>();
    const [theme, setTheme] = useState<ThemePreference>("system");
    const [focusUpdates, setFocusUpdates] = useState(false);
    const [quickStartOpen, setQuickStartOpen] = useState(() => localStorage.getItem(quickStartCompletionKey) === null);
    const [hasUsableAiConnection, setHasUsableAiConnection] = useState(false);
    const desktopShell = getDesktopShellClient();
    const dispatcher = useKeyBindingDispatcher(keyBindingOverrides, desktopShell !== undefined);

    useThemeAppearance(theme);

    useEffect(() => {
        void client.getApplicationSettings().then((settings) => {
            setKeyBindingOverrides(settings.keyBindingOverrides);
            setTheme(settings.general.theme);
            setHasUsableAiConnection(settings.connections.some((connection) => connection.active !== false && connection.status === "connected"));
            void saveScheduledWebBackup(client, settings.backupPolicy).catch(() => undefined);
        });
    }, [client]);

    useEffect(() => {
        void getDesktopUpdateClient()?.rendererReady();
    }, []);

    const closeQuickStart = () => {
        localStorage.setItem(quickStartCompletionKey, "complete");
        setQuickStartOpen(false);
    };

    const openQuickStart = () => setQuickStartOpen(true);
    const openModelSettings = () => {
        setSettingsSection("ai");
        setScreen("application-settings");
    };

    useEffect(() => {
        if (!desktopShell)
            return;

        const unregister = desktopShellCommands.map((command) => dispatcher.register(command, () => desktopShell.execute(command)));
        return () => unregister.forEach((remove) => remove());
    }, [desktopShell, dispatcher]);

    useEffect(() => {
        const openUpdates = () => {
            setFocusUpdates(true);
            setScreen("application-settings");
        };
        window.addEventListener("skladno:open-updates", openUpdates);
        return () => window.removeEventListener("skladno:open-updates", openUpdates);
    }, []);

    return <I18nProvider client={client}>
        <NotificationProvider>
            <EditorialWorkspaceProvider
                context={{ client, screen, settingsSection }}
                navigation={{ openSettings: () => {
                    setSettingsSection("general");
                    setScreen("application-settings");
                }, openModelSettings, openQuickStart, backToWorkspace: () => setScreen("editorial-workspace") }}
                bindings={{ dispatcher, keyBindingOverrides: keyBindingOverrides ?? {}, onKeyBindingsUpdated: setKeyBindingOverrides, onThemeApplied: setTheme }}
                updates={{ focusUpdates, onUpdatesFocused: () => setFocusUpdates(false) }}
            />
            {quickStartOpen && <QuickStartDialog hasUsableAiConnection={hasUsableAiConnection} close={closeQuickStart} openModelSettings={openModelSettings} />}
        </NotificationProvider>
    </I18nProvider>;
}
