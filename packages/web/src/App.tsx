import { useEffect, useLayoutEffect, useState } from "react";
import { HttpApplicationClient, type EditorialWorkspaceClient } from "./application-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";
import { I18nProvider } from "./i18n/I18nProvider.js";
import { NotificationProvider } from "./notifications/NotificationProvider.js";
import { useKeyBindingDispatcher } from "./key-bindings/KeyBindingProvider.js";
import { saveScheduledWebBackup } from "./settings/web-backups.js";
import { resolveTheme, type KeyBindingOverrides, type ResolvedTheme, type ThemePreference } from "@skladno/shared";

const defaultClient = new HttpApplicationClient();


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
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>();
    const [theme, setTheme] = useState<ThemePreference>("system");
    const dispatcher = useKeyBindingDispatcher(keyBindingOverrides);

    useThemeAppearance(theme);

    useEffect(() => {
        void client.getApplicationSettings().then((settings) => {
            setKeyBindingOverrides(settings.keyBindingOverrides);
            setTheme(settings.general.theme);
            void saveScheduledWebBackup(client, settings.backupPolicy).catch(() => undefined);
        });
    }, [client]);

    return <I18nProvider client={client}>
        <NotificationProvider>
            <EditorialWorkspaceProvider client={client}
                screen={screen}
                openSettings={() => setScreen("application-settings")}
                backToWorkspace={() => setScreen("editorial-workspace")}
                dispatcher={dispatcher}
                keyBindingOverrides={keyBindingOverrides ?? {}}
                onKeyBindingsUpdated={setKeyBindingOverrides}
                onThemeApplied={setTheme}
            />
        </NotificationProvider>
    </I18nProvider>;
}
