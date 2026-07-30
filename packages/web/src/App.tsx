import { HttpApplicationClient, type EditorialWorkspaceClient } from "./application-client.js";
import { EditorialWorkspaceProvider } from "./workspace/EditorialWorkspace.js";

const defaultClient = new HttpApplicationClient();


export function App({ client = defaultClient }: { client?: EditorialWorkspaceClient }) {
    return <EditorialWorkspaceProvider client={client} />;
}
