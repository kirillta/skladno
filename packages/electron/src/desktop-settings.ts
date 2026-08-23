import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { IpcMain, IpcRenderer, Shell } from "electron";
import type { ApplicationServices } from "@skladno/server/electron";
import { ApplicationClientError, type ApplicationErrorCode, type DesktopSettingsClient, type DesktopSettingsLocations } from "@skladno/shared";


export const desktopSettingsChannel = "skladno:desktop-settings";


interface RuntimeSettings { backupDirectory?: string }


function readRuntimeSettings(path: string): RuntimeSettings {
    try {
        const value: unknown = JSON.parse(readFileSync(path, "utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value))
            return {};

        const backupDirectory = (value as Record<string, unknown>).backupDirectory;
        return typeof backupDirectory === "string" && backupDirectory ? { backupDirectory } : {};
    } catch {
        return {};
    }
}


function writeRuntimeSettings(path: string, settings: RuntimeSettings): void {
    mkdirSync(join(path, ".."), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(settings), { mode: 0o600 });
    renameSync(temporary, path);
}


function overlaps(first: string, second: string): boolean {
    const path = relative(resolve(first), resolve(second));
    return path === "" || (!path.startsWith("..") && !path.includes(":"));
}


export function registerDesktopSettingsAdapter({ ipcMain, shell, userDataPath, dataDirectory, database, services, chooseDirectory }: {
    ipcMain: IpcMain;
    shell: Pick<Shell, "openPath">;
    userDataPath: string;
    dataDirectory: string;
    database: { exec(sql: string): void };
    services: ApplicationServices;
    chooseDirectory(): Promise<string | undefined>;
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

                    writeRuntimeSettings(runtimePath, { backupDirectory: selected });
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

                    mkdirSync(runtime.backupDirectory, { recursive: true });
                    const created = new Date();
                    const filename = `skladno-backup-${created.toISOString().replaceAll(/[:.]/g, "-")}.sqlite`;
                    const temporary = join(runtime.backupDirectory, `.${filename}.tmp`);
                    database.exec(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
                    renameSync(temporary, join(runtime.backupDirectory, filename));

                    return { ok: true, value: { path: join(runtime.backupDirectory, filename), createdAt: created.toISOString() } };
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
        addManagedAiConnection: ({ label, apiKey }) => invoke("addManagedAiConnection", label, apiKey),
        renameManagedAiConnection: (connectionId, label) => invoke("renameManagedAiConnection", connectionId, label),
        removeManagedAiConnection: (connectionId) => invoke("removeManagedAiConnection", connectionId),
    };
}
