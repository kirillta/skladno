import { useEffect, useState } from "react";
import { HttpApplicationClient, type EditorialWorkspaceClient } from "./application-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";
import { I18nProvider } from "./i18n/I18nProvider.js";
import { NotificationProvider } from "./notifications/NotificationProvider.js";
import { useKeyBindingDispatcher } from "./key-bindings/KeyBindingProvider.js";

const defaultClient = new HttpApplicationClient();


export function App({ client = defaultClient }: { client?: EditorialWorkspaceClient }) {
    const [screen, setScreen] = useState<"editorial-workspace" | "application-settings">("editorial-workspace");
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<import("@skladno/shared").KeyBindingOverrides>();
    useKeyBindingDispatcher(keyBindingOverrides);

    useEffect(() => {
        void client.getApplicationSettings().then((settings) => setKeyBindingOverrides(settings.keyBindingOverrides));
    }, [client]);

    return <I18nProvider client={client}>
        <NotificationProvider>
            <EditorialWorkspaceProvider client={client}
                screen={screen}
                openSettings={() => setScreen("application-settings")}
                backToWorkspace={() => setScreen("editorial-workspace")}
            />
        </NotificationProvider>
    </I18nProvider>;
}
