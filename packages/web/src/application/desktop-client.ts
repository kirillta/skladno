import { ApplicationClientError, type ApplicationErrorCode, type DesktopSettingsClient, type DesktopShellClient, type DesktopTelemetryClient, type DesktopUpdateClient, type ElectronApplicationBridge, type EditorialWorkspaceClient } from "@skladno/shared";
import { HttpApplicationClient } from "./client.js";


declare global {
    interface Window {
        skladno?: ElectronApplicationBridge;
        skladnoDesktop?: DesktopSettingsClient;
        skladnoShell?: DesktopShellClient;
        skladnoUpdates?: DesktopUpdateClient;
        skladnoTelemetry?: DesktopTelemetryClient;
    }
}


export function createRendererApplicationClient(host: Pick<Window, "skladno"> = window): EditorialWorkspaceClient {
    const bridge = host.skladno;
    if (!bridge)
        return new HttpApplicationClient();

    const stream = <Event extends { type: string; errorCode?: ApplicationErrorCode }>(start: (streamId: string, onEvent: (event: Event) => void) => Promise<void>, onEvent: (event: Event) => void, signal?: AbortSignal) => {
        if (signal?.aborted)
            return Promise.reject(new DOMException("The Electron application request was aborted.", "AbortError"));

        const streamId = crypto.randomUUID();
        let errorCode: ApplicationErrorCode | undefined;
        let rejectAborted: (error: Error) => void = () => undefined;
        const aborted = new Promise<void>((_resolve, reject) => {
            rejectAborted = reject;
        });
        const abort = () => {
            bridge.cancelStream(streamId);
            rejectAborted(new DOMException("The Electron application request was aborted.", "AbortError"));
        };
        signal?.addEventListener("abort", abort, { once: true });

        return Promise.race([start(streamId, (event) => {
            if (event.type === "error")
                errorCode = event.errorCode;

            onEvent(event);
        }), aborted]).catch((error: unknown) => {
            if (errorCode && !signal?.aborted)
                throw new ApplicationClientError(errorCode, undefined, 500);

            throw error;
        }).finally(() => signal?.removeEventListener("abort", abort));
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


export function getDesktopTelemetryClient(host: Pick<Window, "skladnoTelemetry"> = window): DesktopTelemetryClient | undefined {
    return host.skladnoTelemetry;
}
