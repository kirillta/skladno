import { useState } from "react";
import { HttpApplicationClient, type EditorialWorkspaceClient } from "./application-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";
import { I18nProvider } from "./i18n/I18nProvider.js";

const defaultClient = new HttpApplicationClient();


export function App({ client = defaultClient }: { client?: EditorialWorkspaceClient }) {
    const [screen, setScreen] = useState<"editorial-workspace" | "application-settings">("editorial-workspace");
    return <I18nProvider client={client}>
        <EditorialWorkspaceProvider client={client}
            screen={screen}
            openSettings={() => setScreen("application-settings")}
            backToWorkspace={() => setScreen("editorial-workspace")}
        />
    </I18nProvider>;
}
