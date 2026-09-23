import type { IpcMain, IpcRenderer } from "electron";
import { ApplicationClientError, isDesktopUpdateState, type ApplicationErrorCode, type DesktopUpdateClient } from "@skladno/shared";
import { createDesktopUpdateCoordinator } from "./desktop-update-coordinator.js";

export { createDesktopUpdateCoordinator } from "./desktop-update-coordinator.js";

export const desktopUpdatesChannel = "skladno:desktop-updates";
export const desktopUpdatesEvent = "skladno:desktop-updates:state";


function readEnabled(request: unknown): boolean | undefined {
    if (!request || typeof request !== "object")
        return undefined;

    const enabled = (request as Record<string, unknown>).enabled;
    return typeof enabled === "boolean" ? enabled : undefined;
}


function setUpdateOption(request: unknown, update: (enabled: boolean) => unknown): unknown {
    const enabled = readEnabled(request);
    return enabled === undefined ? { ok: false, error: "invalid_request" } : { ok: true, value: update(enabled) };
}


function handleDesktopUpdateRequest(method: unknown, request: unknown, coordinator: ReturnType<typeof createDesktopUpdateCoordinator>): unknown {
    switch (method) {
        case "getState":
            return { ok: true, value: coordinator.getState() };
        case "setNetworkAccess":
            return setUpdateOption(request, (enabled) => coordinator.setNetworkAccess(enabled));
        case "setAutomaticChecks":
            return setUpdateOption(request, (enabled) => coordinator.setAutomaticChecks(enabled));
        case "setIncludePrereleases":
            return setUpdateOption(request, (enabled) => coordinator.setIncludePrereleases(enabled));
        case "checkNow":
            return coordinator.checkNow().then((value) => ({ ok: true, value }));
        case "download":
            return { ok: true, value: coordinator.download() };
        case "restartAndUpdate":
            return coordinator.restartAndUpdate().then(() => ({ ok: true, value: undefined }));
        case "openReleaseNotes":
            return coordinator.openReleaseNotes().then(() => ({ ok: true, value: undefined }));
        case "openRecoveryGuide":
            return coordinator.openRecoveryGuide().then(() => ({ ok: true, value: undefined }));
        case "rendererReady":
            coordinator.markStartupSuccessful();
            return { ok: true, value: undefined };
        default:
            return { ok: false, error: "invalid_request" };
    }
}


export function supportsNativeUpdates(platform = process.platform): boolean {
    return platform === "win32";
}


export function supportsReleaseDiscovery(platform = process.platform): boolean {
    return platform === "win32" || platform === "linux";
}


export function registerDesktopUpdatesAdapter({ ipcMain, coordinator }: { ipcMain: IpcMain; coordinator: ReturnType<typeof createDesktopUpdateCoordinator> }): void {
    ipcMain.handle(desktopUpdatesChannel, async (_event, request: unknown) => {
        const method = request && typeof request === "object" ? (request as Record<string, unknown>).method : undefined;
        try {
            return await handleDesktopUpdateRequest(method, request, coordinator);
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}


export function createDesktopUpdateClient(ipcRenderer: Pick<IpcRenderer, "invoke" | "on" | "removeListener">): DesktopUpdateClient {
    async function invoke<T>(method: string, enabled?: boolean): Promise<T> {
        const result = await ipcRenderer.invoke(desktopUpdatesChannel, {
            method,
            ...(enabled === undefined ? {} : { enabled })
        }) as { ok: boolean; value?: T; error?: ApplicationErrorCode };

        if (!result.ok)
            throw new ApplicationClientError(result.error ?? "editorial_request_failed", undefined, 500);

        if (method !== "restartAndUpdate" && method !== "openReleaseNotes" && method !== "openRecoveryGuide" && !isDesktopUpdateState(result.value))
            throw new ApplicationClientError("editorial_request_failed", undefined, 500);

        return result.value as T;
    }


    return {
        getState: () => invoke("getState"),
        setNetworkAccess: (enabled) => invoke("setNetworkAccess", enabled),
        setAutomaticChecks: (enabled) => invoke("setAutomaticChecks", enabled),
        setIncludePrereleases: (enabled) => invoke("setIncludePrereleases", enabled),
        checkNow: () => invoke("checkNow"),
        download: () => invoke("download"),
        restartAndUpdate: () => invoke("restartAndUpdate"),
        openReleaseNotes: () => invoke("openReleaseNotes"),
        openRecoveryGuide: () => invoke("openRecoveryGuide"),
        rendererReady: () => invoke("rendererReady"),
        subscribe(listener) {
            const receive = (_event: unknown, state: unknown) => {
                if (isDesktopUpdateState(state))
                    listener(state);
            };
            ipcRenderer.on(desktopUpdatesEvent, receive);

            return () => ipcRenderer.removeListener(desktopUpdatesEvent, receive);
        },
    };
}
