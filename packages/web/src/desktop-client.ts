import type { DesktopSettingsClient, DesktopShellClient, DesktopUpdateClient, EditorialWorkspaceClient } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client.js";


declare global {
    interface Window {
        skladno?: EditorialWorkspaceClient;
        skladnoDesktop?: DesktopSettingsClient;
        skladnoShell?: DesktopShellClient;
        skladnoUpdates?: DesktopUpdateClient;
    }
}


export function createRendererApplicationClient(host: Pick<Window, "skladno"> = window): EditorialWorkspaceClient {
    return host.skladno ?? new HttpApplicationClient();
}


export function getDesktopSettingsClient(host: Pick<Window, "skladnoDesktop"> = window): DesktopSettingsClient | undefined {
    return host.skladnoDesktop;
}


export function getDesktopShellClient(host: Pick<Window, "skladnoShell"> = window): DesktopShellClient | undefined {
    return host.skladnoShell;
}


export function getDesktopUpdateClient(host: Pick<Window, "skladnoUpdates"> = window): DesktopUpdateClient | undefined {
    return host.skladnoUpdates;
}
