import { basename, join, relative, resolve } from "node:path";
import type { Dialog, IpcMain, Shell } from "electron";
import type { ApplicationServices } from "@skladno/server/electron";
import { type DesktopSettingsLocations, type ElectronMessages, type TelemetryCaptureSource } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings } from "../../infrastructure/runtime/runtime-settings.js";
import { desktopSettingsChannel } from "./desktop-settings-client.js";
import { createNativeBackup } from "./desktop-native-backup.js";
import { createLocalDataDeletion, createNativeBackupRestoration } from "./desktop-settings-recovery.js";


function areSettingsKeysOverlapping(first: string, second: string): boolean {
    const path = relative(resolve(first), resolve(second));
    return path === "" || (!path.startsWith("..") && !path.includes(":"));
}


interface DesktopSettingsAdapterOptions {
    ipcMain: IpcMain;
    shell: Pick<Shell, "openPath">;
    dialog: Pick<Dialog, "showMessageBox">;
    userDataPath: string;
    dataDirectory: string;
    database: { exec(sql: string): void };
    telemetry?: TelemetryCaptureSource;
    services: ApplicationServices;
    messages: ElectronMessages;
    chooseDirectory(): Promise<string | undefined>;
    chooseBackupSnapshot(directory: string): Promise<string | undefined>;
    requestCheckpoint(): Promise<boolean>;
    closeApplication(): void;
    restart(): void;
}


type DesktopSettingsContext = Omit<DesktopSettingsAdapterOptions, "ipcMain" | "userDataPath"> & {
    runtimePath: string;
    runtime: ReturnType<typeof readRuntimeSettings>;
};


function getLocations({ dataDirectory, runtime }: Pick<DesktopSettingsContext, "dataDirectory" | "runtime">): DesktopSettingsLocations {
    return { dataDirectory, ...(runtime.backupDirectory ? { backupDirectory: runtime.backupDirectory } : {}), dataDirectoryExternallyControlled: Boolean(process.env.SKLADNO_DATA_DIR) };
}


async function chooseBackupDirectory({ runtimePath, dataDirectory, chooseDirectory }: Pick<DesktopSettingsContext, "runtimePath" | "dataDirectory" | "chooseDirectory">): Promise<unknown> {
    const selected = await chooseDirectory();
    if (!selected)
        return { ok: true, value: undefined };

    if (areSettingsKeysOverlapping(selected, dataDirectory) || areSettingsKeysOverlapping(dataDirectory, selected))
        return { ok: false, error: "invalid_request" };

    updateRuntimeSettings(runtimePath, (current) => ({ ...current, backupDirectory: selected }));
    return { ok: true, value: selected };
}


async function revealBackupDirectory({ runtime, shell }: Pick<DesktopSettingsContext, "runtime" | "shell">): Promise<unknown> {
    if (!runtime.backupDirectory)
        return { ok: false, error: "editorial_request_failed" };

    await shell.openPath(runtime.backupDirectory);
    return { ok: true, value: undefined };
}


async function revealDataDirectory({ dataDirectory, shell }: Pick<DesktopSettingsContext, "dataDirectory" | "shell">): Promise<unknown> {
    await shell.openPath(dataDirectory);
    return { ok: true, value: undefined };
}


async function revealCreatedSkillDirectory({ services, shell }: Pick<DesktopSettingsContext, "services" | "shell">, requestId: string): Promise<unknown> {
    const directory = services.authorSkills?.createdSkillDirectory(requestId);
    if (!directory)
        return { ok: false, error: "editorial_request_failed" };

    await shell.openPath(directory);
    return { ok: true, value: undefined };
}


function createBackup({ runtime, dataDirectory, database, telemetry }: Pick<DesktopSettingsContext, "runtime" | "dataDirectory" | "database" | "telemetry">): unknown {
    if (!runtime.backupDirectory)
        return { ok: false, error: "editorial_request_failed" };

    return { ok: true, value: createNativeBackup(database, dataDirectory, runtime.backupDirectory, telemetry) };
}


async function deleteLocalData({ dialog, messages, deletion }: Pick<DesktopSettingsContext, "dialog" | "messages"> & { deletion: ReturnType<typeof createLocalDataDeletion> }): Promise<unknown> {
    const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: messages["electron.deleteData.title"],
        message: messages["electron.deleteData.message"],
        detail: messages["electron.deleteData.detail"],
        buttons: [messages["electron.deleteData.delete"], messages["electron.deleteData.cancel"]],
        defaultId: 1,
        cancelId: 1,
        checkboxLabel: messages["electron.deleteData.backup"],
        checkboxChecked: deletion.backupAvailable,
        noLink: true,
    });
    if (confirmation.response !== 0)
        return { ok: true, value: undefined };

    const error = deletion.execute(confirmation.checkboxChecked);
    if (error)
        return { ok: false, error };

    return { ok: true, value: undefined };
}


async function restoreNativeBackup({ dialog, messages, restoration }: Pick<DesktopSettingsContext, "dialog" | "messages"> & { restoration: ReturnType<typeof createNativeBackupRestoration> }): Promise<unknown> {
    if (!restoration.available)
        return { ok: false, error: "editorial_request_failed" };

    const selection = await restoration.select();
    if (selection.kind === "cancelled")
        return { ok: true, value: undefined };

    if (selection.kind === "invalid")
        return { ok: false, error: "invalid_request" };

    const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: messages["electron.restoreBackup.title"],
        message: messages["electron.restoreBackup.message"],
        detail: `${messages["electron.restoreBackup.detail"]}\n\n${basename(selection.path)}`,
        buttons: [messages["electron.restoreBackup.restore"], messages["electron.restoreBackup.cancel"]],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
    });

    if (confirmation.response !== 0)
        return { ok: true, value: undefined };

    const error = await restoration.execute(selection.path);
    if (error)
        return { ok: false, error };

    return { ok: true, value: undefined };
}


async function addManagedAiConnection({ services }: Pick<DesktopSettingsContext, "services">, args: unknown[]): Promise<unknown> {
    const value = await services.settings.createManagedAiConnection({ provider: args[0], label: args[1], apiKey: args[2] });
    return { ok: true, value };
}


function renameManagedAiConnection({ services }: Pick<DesktopSettingsContext, "services">, args: unknown[]): unknown {
    return { ok: true, value: services.settings.renameManagedAiConnection(String(args[0]), args[1]) };
}


function removeManagedAiConnection({ services }: Pick<DesktopSettingsContext, "services">, args: unknown[]): unknown {
    services.settings.deleteAiConnection(String(args[0]));
    return { ok: true, value: undefined };
}


export function registerDesktopSettingsAdapter({ ipcMain, userDataPath, ...options }: DesktopSettingsAdapterOptions): void {
    const runtimePath = join(userDataPath, "runtime-settings.json");
    ipcMain.handle(desktopSettingsChannel, async (_event, request: unknown) => {
        const method = request && typeof request === "object" ? (request as Record<string, unknown>).method : undefined;
        const args = request && typeof request === "object" && Array.isArray((request as Record<string, unknown>).args) ? (request as { args: unknown[] }).args : [];
        const runtime = readRuntimeSettings(runtimePath);
        const context = { ...options, runtimePath, runtime };
        try {
            switch (method) {
                case "getLocations":
                    return { ok: true, value: getLocations(context) };
                case "chooseBackupDirectory":
                    return await chooseBackupDirectory(context);
                case "revealBackupDirectory":
                    return await revealBackupDirectory(context);
                case "revealDataDirectory":
                    return await revealDataDirectory(context);
                case "revealCreatedSkillDirectory":
                    return await revealCreatedSkillDirectory(context, String(args[0]));
                case "createNativeBackup":
                    return createBackup(context);
                case "restoreNativeBackup":
                    return await restoreNativeBackup({
                        dialog: context.dialog,
                        messages: context.messages,
                        restoration: createNativeBackupRestoration({
                            runtimePath: context.runtimePath,
                            dataDirectory: context.dataDirectory,
                            backupDirectory: context.runtime.backupDirectory,
                            database: context.database,
                            chooseBackupSnapshot: context.chooseBackupSnapshot,
                            requestCheckpoint: context.requestCheckpoint,
                            closeApplication: context.closeApplication,
                            restart: context.restart,
                            telemetry: context.telemetry,
                        }),
                    });
                case "deleteLocalData":
                    return await deleteLocalData({
                        dialog: context.dialog,
                        messages: context.messages,
                        deletion: createLocalDataDeletion({
                            dataDirectory: context.dataDirectory,
                            backupDirectory: context.runtime.backupDirectory,
                            database: context.database,
                            closeApplication: context.closeApplication,
                            restart: context.restart,
                            telemetry: context.telemetry,
                        }),
                    });
                case "addManagedAiConnection":
                    return await addManagedAiConnection(context, args);
                case "renameManagedAiConnection":
                    return renameManagedAiConnection(context, args);
                case "removeManagedAiConnection":
                    return removeManagedAiConnection(context, args);
                default:
                    return { ok: false, error: "invalid_request" };
            }
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}
