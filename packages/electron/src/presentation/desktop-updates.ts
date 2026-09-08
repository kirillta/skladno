import type { IpcMain, IpcRenderer } from "electron";
import { ApplicationClientError, isDesktopUpdateState, type ApplicationErrorCode, type DesktopUpdateClient } from "@skladno/shared";
import { createDesktopUpdateCoordinator } from "./desktop-update-coordinator.js";

export { createDesktopUpdateCoordinator } from "./desktop-update-coordinator.js";

export const desktopUpdatesChannel = "skladno:desktop-updates";
export const desktopUpdatesEvent = "skladno:desktop-updates:state";


export function registerDesktopUpdatesAdapter({ ipcMain, coordinator }: { ipcMain: IpcMain; coordinator: ReturnType<typeof createDesktopUpdateCoordinator> }): void {
    ipcMain.handle(desktopUpdatesChannel, async (_event, request: unknown) => {
        const method = request && typeof request === "object" ? (request as Record<string, unknown>).method : undefined;
        try {
            switch (method) {
                case "getState": return { ok: true, value: coordinator.getState() };
                case "setNetworkAccess":
                    return typeof (request as Record<string, unknown>).enabled === "boolean"
                        ? { ok: true, value: coordinator.setNetworkAccess((request as Record<string, boolean>).enabled) }
                        : { ok: false, error: "invalid_request" };
                case "setAutomaticChecks":
                    return typeof (request as Record<string, unknown>).enabled === "boolean"
                        ? { ok: true, value: coordinator.setAutomaticChecks((request as Record<string, boolean>).enabled) }
                        : { ok: false, error: "invalid_request" };
                case "setIncludePrereleases":
                    return typeof (request as Record<string, unknown>).enabled === "boolean"
                        ? { ok: true, value: coordinator.setIncludePrereleases((request as Record<string, boolean>).enabled) }
                        : { ok: false, error: "invalid_request" };
                case "checkNow": return { ok: true, value: await coordinator.checkNow() };
                case "download": return { ok: true, value: coordinator.download() };
                case "restartAndUpdate":
                    await coordinator.restartAndUpdate();
                    return { ok: true, value: undefined };
                case "openReleaseNotes":
                    await coordinator.openReleaseNotes();
                    return { ok: true, value: undefined };
                case "openRecoveryGuide":
                    await coordinator.openRecoveryGuide();
                    return { ok: true, value: undefined };
                case "rendererReady":
                    coordinator.markStartupSuccessful();
                    return { ok: true, value: undefined };
                default: return { ok: false, error: "invalid_request" };
            }
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}


export function createDesktopUpdateClient(ipcRenderer: Pick<IpcRenderer, "invoke" | "on" | "removeListener">): DesktopUpdateClient {
    async function invoke<T>(method: string, enabled?: boolean): Promise<T> {
        const result = await ipcRenderer.invoke(desktopUpdatesChannel, { method, ...(enabled === undefined ? {} : { enabled }) }) as { ok: boolean; value?: T; error?: ApplicationErrorCode };
        if (!result.ok)
            throw new ApplicationClientError(result.error ?? "editorial_request_failed", undefined, 500);

        if (method !== "restartAndUpdate" && method !== "openReleaseNotes" && method !== "openRecoveryGuide" && !isDesktopUpdateState(result.value))
            throw new ApplicationClientError("editorial_request_failed", undefined, 500);

        return result.value as T;
    }


    return {
        getState: () => invoke("getState"), setNetworkAccess: (enabled) => invoke("setNetworkAccess", enabled), setAutomaticChecks: (enabled) => invoke("setAutomaticChecks", enabled), setIncludePrereleases: (enabled) => invoke("setIncludePrereleases", enabled), checkNow: () => invoke("checkNow"), download: () => invoke("download"), restartAndUpdate: () => invoke("restartAndUpdate"), openReleaseNotes: () => invoke("openReleaseNotes"), openRecoveryGuide: () => invoke("openRecoveryGuide"), rendererReady: () => invoke("rendererReady"),
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
