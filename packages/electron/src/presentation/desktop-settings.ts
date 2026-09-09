import { copyFileSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join, parse, relative, resolve } from "node:path";
import type { Dialog, IpcMain, Shell } from "electron";
import type { ApplicationServices } from "@skladno/server/electron";
import { validateDatabaseSnapshot } from "@skladno/server/electron";
import { type DesktopSettingsLocations, type ElectronMessages } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings } from "../infrastructure/runtime-settings.js";
import { desktopSettingsChannel } from "./desktop-settings-client.js";


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


interface DesktopSettingsAdapterOptions {
    ipcMain: IpcMain;
    shell: Pick<Shell, "openPath">;
    dialog: Pick<Dialog, "showMessageBox">;
    userDataPath: string;
    dataDirectory: string;
    database: { exec(sql: string): void };
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

    if (overlaps(selected, dataDirectory) || overlaps(dataDirectory, selected))
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


function createBackup({ runtime, database }: Pick<DesktopSettingsContext, "runtime" | "database">): unknown {
    if (!runtime.backupDirectory)
        return { ok: false, error: "editorial_request_failed" };

    return { ok: true, value: createNativeBackup(database, runtime.backupDirectory) };
}


async function deleteLocalData({ runtime, dataDirectory, database, dialog, messages, closeApplication, restart }: Pick<DesktopSettingsContext, "runtime" | "dataDirectory" | "database" | "dialog" | "messages" | "closeApplication" | "restart">): Promise<unknown> {
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
    restart();

    return { ok: true, value: undefined };
}


async function restoreNativeBackup({ runtimePath, runtime, database, dialog, messages, chooseBackupSnapshot, requestCheckpoint, closeApplication, restart }: Pick<DesktopSettingsContext, "runtimePath" | "runtime" | "database" | "dialog" | "messages" | "chooseBackupSnapshot" | "requestCheckpoint" | "closeApplication" | "restart">): Promise<unknown> {
    if (!runtime.backupDirectory)
        return { ok: false, error: "editorial_request_failed" };

    const selected = await chooseBackupSnapshot(runtime.backupDirectory);
    if (!selected)
        return { ok: true, value: undefined };

    if (!overlaps(runtime.backupDirectory, selected))
        return { ok: false, error: "invalid_request" };

    validateDatabaseSnapshot(selected);
    const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: messages["electron.restoreBackup.title"],
        message: messages["electron.restoreBackup.message"],
        detail: `${messages["electron.restoreBackup.detail"]}\n\n${basename(selected)}`,
        buttons: [messages["electron.restoreBackup.restore"], messages["electron.restoreBackup.cancel"]],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
    });

    if (confirmation.response !== 0)
        return { ok: true, value: undefined };

    if (!await requestCheckpoint())
        return { ok: false, error: "editorial_request_failed" };

    const stagingDirectory = join(parse(runtimePath).dir, "restore-staging");
    mkdirSync(stagingDirectory, { recursive: true });

    const stagedSnapshotPath = join(stagingDirectory, `${randomUUID()}.sqlite`);
    copyFileSync(selected, stagedSnapshotPath);
    validateDatabaseSnapshot(stagedSnapshotPath);

    const recoverySnapshotPath = createNativeBackup(database, stagingDirectory).path;
    updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: { stagedSnapshotPath, recoverySnapshotPath, phase: "ready" } }));
    closeApplication();
    restart();

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
                case "createNativeBackup":
                    return createBackup(context);
                case "restoreNativeBackup":
                    return await restoreNativeBackup(context);
                case "deleteLocalData":
                    return await deleteLocalData(context);
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
