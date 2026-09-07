import type { IpcRenderer } from "electron";
import { ApplicationClientError, type ApplicationErrorCode, type DesktopSettingsClient } from "@skladno/shared";


export const desktopSettingsChannel = "skladno:desktop-settings";


export function createDesktopSettingsClient(ipcRenderer: Pick<IpcRenderer, "invoke">): DesktopSettingsClient {
    async function invoke<T>(method: string, ...args: unknown[]): Promise<T> {
        const result = await ipcRenderer.invoke(desktopSettingsChannel, { method, args }) as { ok: boolean; value?: T; error?: ApplicationErrorCode };
        if (!result.ok)
            throw new ApplicationClientError(result.error ?? "editorial_request_failed", undefined, 500);

        return result.value as T;
    }


    return {
        getLocations: () => invoke("getLocations"),
        chooseBackupDirectory: () => invoke("chooseBackupDirectory"),
        revealBackupDirectory: () => invoke("revealBackupDirectory"),
        revealDataDirectory: () => invoke("revealDataDirectory"),
        createNativeBackup: () => invoke("createNativeBackup"),
        restoreNativeBackup: () => invoke("restoreNativeBackup"),
        deleteLocalData: () => invoke("deleteLocalData"),
        addManagedAiConnection: ({ provider, label, apiKey }) => invoke("addManagedAiConnection", provider, label, apiKey),
        renameManagedAiConnection: (connectionId, label) => invoke("renameManagedAiConnection", connectionId, label),
        removeManagedAiConnection: (connectionId) => invoke("removeManagedAiConnection", connectionId),
    };
}
