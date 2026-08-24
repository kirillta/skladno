import type { DesktopSettingsClient, EditorialWorkspaceClient } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client.js";


declare global {
    interface Window {
        skladno?: EditorialWorkspaceClient;
        skladnoDesktop?: DesktopSettingsClient;
    }
}


export function createRendererApplicationClient(host: Pick<Window, "skladno"> = window): EditorialWorkspaceClient {
    return host.skladno ?? new HttpApplicationClient();
}


export function getDesktopSettingsClient(host: Pick<Window, "skladnoDesktop"> = window): DesktopSettingsClient | undefined {
    return host.skladnoDesktop;
}
