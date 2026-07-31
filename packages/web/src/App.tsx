import { useState } from "react";
import { HttpApplicationClient, type EditorialWorkspaceClient } from "./application-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";

const defaultClient = new HttpApplicationClient();


export function App({ client = defaultClient }: { client?: EditorialWorkspaceClient }) {
    const [screen, setScreen] = useState<"editorial-workspace" | "application-settings">("editorial-workspace");
    return <EditorialWorkspaceProvider client={client}
        screen={screen}
        openSettings={() => setScreen("application-settings")}
        backToWorkspace={() => setScreen("editorial-workspace")}
    />;
}
