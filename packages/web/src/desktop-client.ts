import type { DesktopSettingsClient, DesktopShellClient, DesktopUpdateClient, ElectronApplicationBridge, EditorialWorkspaceClient } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client.js";


declare global {
    interface Window {
        skladno?: ElectronApplicationBridge;
        skladnoDesktop?: DesktopSettingsClient;
        skladnoShell?: DesktopShellClient;
        skladnoUpdates?: DesktopUpdateClient;
    }
}


export function createRendererApplicationClient(host: Pick<Window, "skladno"> = window): EditorialWorkspaceClient {
    const bridge = host.skladno;
    if (!bridge)
        return new HttpApplicationClient();

    const stream = <Event>(start: (streamId: string, onEvent: (event: Event) => void) => Promise<void>, onEvent: (event: Event) => void, signal?: AbortSignal) => {
        if (signal?.aborted)
            return Promise.reject(new DOMException("The Electron application request was aborted.", "AbortError"));

        const streamId = crypto.randomUUID();
        let rejectAborted: (error: Error) => void = () => undefined;
        const aborted = new Promise<void>((_resolve, reject) => {
            rejectAborted = reject;
        });
        const abort = () => {
            bridge.cancelStream(streamId);
            rejectAborted(new DOMException("The Electron application request was aborted.", "AbortError"));
        };
        signal?.addEventListener("abort", abort, { once: true });

        return Promise.race([start(streamId, onEvent), aborted]).finally(() => signal?.removeEventListener("abort", abort));
    };

    return {
        ...bridge,
        streamAssistantRequest: (articleId, input, onEvent, signal) => stream((streamId, receive) => bridge.streamAssistantRequest(streamId, articleId, input, receive), onEvent, signal),
        streamEditorial: (articleId, input, onEvent, signal) => stream((streamId, receive) => bridge.streamEditorial(streamId, articleId, input, receive), onEvent, signal),
    };
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
