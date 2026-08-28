import { mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, parse, relative, resolve } from "node:path";
import type { Dialog, IpcMain, IpcRenderer, Shell } from "electron";
import type { ApplicationServices } from "@skladno/server/electron";
import { ApplicationClientError, type ApplicationErrorCode, type DesktopSettingsClient, type DesktopSettingsLocations, type ElectronMessages } from "@skladno/shared";
import { readRuntimeSettings, writeRuntimeSettings } from "./runtime-settings.js";


export const desktopSettingsChannel = "skladno:desktop-settings";


function overlaps(first: string, second: string): boolean {
    const path = relative(resolve(first), resolve(second));
    return path === "" || (!path.startsWith("..") && !path.includes(":"));
}


function createNativeBackup(database: { exec(sql: string): void }, backupDirectory: string): { path: string; createdAt: string } {
    mkdirSync(backupDirectory, { recursive: true });
    const created = new Date();
    const filename = `skladno-backup-${created.toISOString().replaceAll(/[:.]/g, "-")}.sqlite`;
    const temporary = join(backupDirectory, `.${filename}.tmp`);
    const path = join(backupDirectory, filename);
    database.exec(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
    renameSync(temporary, path);

    if (statSync(path).size === 0)
        throw new Error("Backup is empty.");

    return { path, createdAt: created.toISOString() };
}


function isSafeDataDirectory(path: string): boolean {
    const resolved = resolve(path);
    return resolved !== parse(resolved).root;
}


export function registerDesktopSettingsAdapter({ ipcMain, shell, dialog, userDataPath, dataDirectory, database, services, messages, chooseDirectory, closeApplication, quit }: {
    ipcMain: IpcMain;
    shell: Pick<Shell, "openPath">;
    dialog: Pick<Dialog, "showMessageBox">;
    userDataPath: string;
    dataDirectory: string;
    database: { exec(sql: string): void };
    services: ApplicationServices;
    messages: ElectronMessages;
    chooseDirectory(): Promise<string | undefined>;
    closeApplication(): void;
    quit(): void;
}): void {
    const runtimePath = join(userDataPath, "runtime-settings.json");
    ipcMain.handle(desktopSettingsChannel, async (_event, request: unknown) => {
        const method = request && typeof request === "object" ? (request as Record<string, unknown>).method : undefined;
        const args = request && typeof request === "object" && Array.isArray((request as Record<string, unknown>).args) ? (request as { args: unknown[] }).args : [];
        const runtime = readRuntimeSettings(runtimePath);
        const locations = (): DesktopSettingsLocations => ({ dataDirectory, ...(runtime.backupDirectory ? { backupDirectory: runtime.backupDirectory } : {}), dataDirectoryExternallyControlled: Boolean(process.env.SKLADNO_DATA_DIR) });
        try {
            switch (method) {
                case "getLocations": return { ok: true, value: locations() };
                case "chooseBackupDirectory": {
                    const selected = await chooseDirectory();
                    if (!selected)
                        return { ok: true, value: undefined };

                    if (overlaps(selected, dataDirectory) || overlaps(dataDirectory, selected))
                        return { ok: false, error: "invalid_request" };

                    writeRuntimeSettings(runtimePath, { ...runtime, backupDirectory: selected });
                    return { ok: true, value: selected };
                }
                case "revealBackupDirectory": {
                    if (!runtime.backupDirectory)
                        return { ok: false, error: "editorial_request_failed" };

                    await shell.openPath(runtime.backupDirectory);
                    return { ok: true, value: undefined };
                }
                case "revealDataDirectory": {
                    await shell.openPath(dataDirectory);
                    return { ok: true, value: undefined };
                }
                case "createNativeBackup": {
                    if (!runtime.backupDirectory)
                        return { ok: false, error: "editorial_request_failed" };

                    return { ok: true, value: createNativeBackup(database, runtime.backupDirectory) };
                }
                case "deleteLocalData": {
                    const backupAvailable = Boolean(runtime.backupDirectory && !overlaps(runtime.backupDirectory, dataDirectory) && !overlaps(dataDirectory, runtime.backupDirectory));
                    const confirmation = await dialog.showMessageBox({
                        type: "warning",
                        title: messages["electron.deleteData.title"],
                        message: messages["electron.deleteData.message"],
                        detail: messages["electron.deleteData.detail"],
                        buttons: [messages["electron.deleteData.delete"], messages["electron.deleteData.cancel"]],
                        defaultId: 1,
                        cancelId: 1,
                        checkboxLabel: messages["electron.deleteData.backup"],
                        checkboxChecked: backupAvailable,
                        noLink: true,
                    });
                    if (confirmation.response !== 0)
                        return { ok: true, value: undefined };

                    if (!isSafeDataDirectory(dataDirectory))
                        return { ok: false, error: "invalid_request" };

                    if (confirmation.checkboxChecked) {
                        if (!backupAvailable)
                            return { ok: false, error: "editorial_request_failed" };

                        createNativeBackup(database, runtime.backupDirectory!);
                    }

                    closeApplication();
                    rmSync(resolve(dataDirectory), { recursive: true, maxRetries: 3, retryDelay: 100 });
                    quit();

                    return { ok: true, value: undefined };
                }
                case "addManagedAiConnection": {
                    const value = await services.settings.createManagedAiConnection({ label: args[0], apiKey: args[1] });
                    return { ok: true, value };
                }
                case "renameManagedAiConnection": return { ok: true, value: services.settings.renameManagedAiConnection(String(args[0]), args[1]) };
                case "removeManagedAiConnection":
                    services.settings.deleteAiConnection(String(args[0]));
                    return { ok: true, value: undefined };
                default: return { ok: false, error: "invalid_request" };
            }
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}


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
        deleteLocalData: () => invoke("deleteLocalData"),
        addManagedAiConnection: ({ label, apiKey }) => invoke("addManagedAiConnection", label, apiKey),
        renameManagedAiConnection: (connectionId, label) => invoke("renameManagedAiConnection", connectionId, label),
        removeManagedAiConnection: (connectionId) => invoke("removeManagedAiConnection", connectionId),
    };
}
