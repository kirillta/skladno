import { contextBridge, ipcRenderer } from "electron";
import {
    ELECTRON_LIFECYCLE_CHANNEL,
    ELECTRON_LIFECYCLE_EVENT,
    type ElectronCheckpointResult,
    type ElectronPrepareCloseRequest,
} from "@skladno/shared";
import { exposeElectronApplicationClient } from "./preload-bridge.js";
import { createDesktopSettingsClient } from "./desktop-settings.js";
import { createDesktopUpdateClient } from "./desktop-updates.js";


function isPrepareCloseRequest(value: unknown): value is ElectronPrepareCloseRequest {
    return value !== null && typeof value === "object" && "requestId" in value && typeof value.requestId === "string";
}


function isCheckpointResult(value: unknown, requestId: string): value is ElectronCheckpointResult {
    return value !== null
        && typeof value === "object"
        && "requestId" in value
        && value.requestId === requestId
        && "ok" in value
        && typeof value.ok === "boolean";
}


function checkpointResult(value: unknown, requestId: string): ElectronCheckpointResult | undefined {
    if (typeof value !== "string")
        return undefined;

    try {
        const parsed: unknown = JSON.parse(value);

        return isCheckpointResult(parsed, requestId) ? parsed : undefined;
    } catch {
        return undefined;
    }
}


exposeElectronApplicationClient(ipcRenderer, contextBridge);
contextBridge.exposeInMainWorld("skladnoDesktop", createDesktopSettingsClient(ipcRenderer));
contextBridge.exposeInMainWorld("skladnoUpdates", createDesktopUpdateClient(ipcRenderer));

ipcRenderer.on(ELECTRON_LIFECYCLE_CHANNEL.prepareClose, (_event, payload: unknown) => {
    if (!isPrepareCloseRequest(payload))
        return;

    const receiveResult = (event: Event) => {
        if (!(event instanceof CustomEvent))
            return;

        const result = checkpointResult(event.detail, payload.requestId);
        if (!result)
            return;

        window.removeEventListener(ELECTRON_LIFECYCLE_EVENT.checkpointResult, receiveResult);
        ipcRenderer.send(ELECTRON_LIFECYCLE_CHANNEL.checkpointResult, result);
    };

    window.addEventListener(ELECTRON_LIFECYCLE_EVENT.checkpointResult, receiveResult);
    window.dispatchEvent(new CustomEvent<string>(ELECTRON_LIFECYCLE_EVENT.prepareClose, { detail: payload.requestId }));
});
