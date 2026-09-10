import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { electronMessagesFor, type TelemetryEvent } from "@skladno/shared";
import { registerDesktopSettingsAdapter } from "./desktop-settings.js";


export function setup(response: number, backupChecked = false, backupFails = false, configuredDataDirectory?: string, backupConfigured = true, chooseDirectory?: (paths: { root: string; dataDirectory: string }) => string | undefined) {
    const root = mkdtempSync(join(tmpdir(), "skladno-delete-test-"));
    const dataDirectory = join(root, "data");
    const backupDirectory = join(root, "backups");
    const userDataPath = join(root, "user-data");
    mkdirSync(dataDirectory);
    mkdirSync(backupDirectory);
    mkdirSync(userDataPath);
    writeFileSync(join(dataDirectory, "skladno.sqlite"), "author data");
    writeFileSync(join(root, "unrelated.txt"), "keep");
    if (backupConfigured)
        writeFileSync(join(userDataPath, "runtime-settings.json"), JSON.stringify({ backupDirectory }));

    let handler: ((event: unknown, request: unknown) => Promise<unknown>) | undefined;
    let checkboxLabel: string | undefined;
    let checkboxInitiallyChecked: boolean | undefined;
    let closed = false;
    let quit = false;
    const telemetry: TelemetryEvent[] = [];
    registerDesktopSettingsAdapter({
        ipcMain: { handle: (_channel: string, listener: (event: unknown, request: unknown) => Promise<unknown>) => {
            handler = listener;
        } } as never,
        shell: { openPath: async () => "" },
        dialog: { showMessageBox: async (options: { checkboxLabel?: string; checkboxChecked?: boolean }) => {
            checkboxLabel = options.checkboxLabel;
            checkboxInitiallyChecked = options.checkboxChecked;
            return { response, checkboxChecked: backupChecked };
        } } as never,
        userDataPath,
        dataDirectory: configuredDataDirectory ?? dataDirectory,
        database: { exec: (sql) => {
            if (backupFails)
                throw new Error("backup failed");

            const temporary = sql.match(/VACUUM INTO '(.+)'/)?.[1];
            if (temporary)
                writeFileSync(temporary, "backup");
        } },
        telemetry: { beginCapture: () => (event) => telemetry.push(event) },
        services: {} as never,
        messages: electronMessagesFor("en"),
        chooseDirectory: async () => chooseDirectory?.({ root, dataDirectory }),
        chooseBackupSnapshot: async () => undefined,
        requestCheckpoint: async () => true,
        closeApplication: () => {
            assert.equal(existsSync(dataDirectory), true);
            closed = true;
        },
        restart: () => {
            quit = true;
        },
    });

    return {
        root,
        dataDirectory,
        backupDirectory,
        checkboxLabel: () => checkboxLabel,
        checkboxInitiallyChecked: () => checkboxInitiallyChecked,
        invoke: async () => handler?.({}, { method: "deleteLocalData", args: [] }),
        invokeRestore: async () => handler?.({}, { method: "restoreNativeBackup", args: [] }),
        invokeChooseBackupDirectory: async () => handler?.({}, { method: "chooseBackupDirectory", args: [] }),
        invokeCreateBackup: async () => handler?.({}, { method: "createNativeBackup", args: [] }),
        closed: () => closed,
        quit: () => quit,
        telemetry: () => telemetry,
        cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
}
