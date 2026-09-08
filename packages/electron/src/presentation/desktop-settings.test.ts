import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import test from "node:test";
import { electronMessagesFor } from "@skladno/shared";
import { registerDesktopSettingsAdapter } from "./desktop-settings.js";


function setup(response: number, backupChecked = false, backupFails = false, configuredDataDirectory?: string, backupConfigured = true, chooseDirectory?: (paths: { root: string; dataDirectory: string }) => string | undefined) {
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
        cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
}


test("a separate backup folder with snapshots and unrelated files can be reused", async () => {
    const fixture = setup(0, false, false, undefined, true, ({ root }) => join(root, "existing-backups"));
    const selectedDirectory = join(fixture.root, "existing-backups");
    mkdirSync(selectedDirectory);
    writeFileSync(join(selectedDirectory, "skladno-backup-2026-01-01.sqlite"), "existing backup");
    writeFileSync(join(selectedDirectory, "keep.txt"), "unrelated");
    try {
        assert.deepEqual(await fixture.invokeChooseBackupDirectory(), { ok: true, value: selectedDirectory });
        await fixture.invokeCreateBackup();
        assert.deepEqual(readdirSync(selectedDirectory).filter((file) => file.endsWith(".sqlite")).length, 2);
        assert.equal(readFileSync(join(selectedDirectory, "keep.txt"), "utf8"), "unrelated");
        assert.equal(JSON.parse(readFileSync(join(fixture.root, "user-data", "runtime-settings.json"), "utf8")).backupDirectory, selectedDirectory);
    } finally {
        fixture.cleanup();
    }
});


test("cancelling backup-folder selection keeps the backup folder", async () => {
    const cancelled = setup(0);
    try {
        assert.deepEqual(await cancelled.invokeChooseBackupDirectory(), { ok: true, value: undefined });
        assert.equal(JSON.parse(readFileSync(join(cancelled.root, "user-data", "runtime-settings.json"), "utf8")).backupDirectory, cancelled.backupDirectory);
    } finally {
        cancelled.cleanup();
    }
});


test("data-directory overlap is rejected without changing the backup folder", async () => {
    const selections = [
        ({ dataDirectory }: { dataDirectory: string }) => dataDirectory,
        ({ root }: { root: string }) => root,
        ({ dataDirectory }: { dataDirectory: string }) => join(dataDirectory, "backups"),
    ];
    for (const chooseDirectory of selections) {
        const fixture = setup(0, false, false, undefined, true, chooseDirectory);
        try {
            assert.deepEqual(await fixture.invokeChooseBackupDirectory(), { ok: false, error: "invalid_request" });
            assert.equal(JSON.parse(readFileSync(join(fixture.root, "user-data", "runtime-settings.json"), "utf8")).backupDirectory, fixture.backupDirectory);
        } finally {
            fixture.cleanup();
        }
    }
});


// product: settings.delete-local-data
test("deleting local data closes first, preserves other files, and exits", async () => {
    const fixture = setup(0);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), true);
        assert.equal(fixture.quit(), true);
        assert.equal(existsSync(fixture.dataDirectory), false);
        assert.equal(readFileSync(join(fixture.root, "unrelated.txt"), "utf8"), "keep");
    } finally {
        fixture.cleanup();
    }
});


test("cancelling backup restoration leaves local data unchanged", async () => {
    const fixture = setup(1);
    try {
        assert.deepEqual(await fixture.invokeRestore(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});


test("backup and deletion creates an isolated snapshot before removal", async () => {
    const fixture = setup(0, true);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), true);
        assert.equal(existsSync(fixture.dataDirectory), false);
        assert.equal(fixture.checkboxLabel(), "Create a backup before deletion");
        assert.equal(fixture.checkboxInitiallyChecked(), true);
        assert.deepEqual(readdirSync(fixture.backupDirectory).filter((file) => file.endsWith(".sqlite")).length, 1);
    } finally {
        fixture.cleanup();
    }
});


test("deletion always shows an unchecked backup checkbox without a backup folder", async () => {
    const fixture = setup(0, false, false, undefined, false);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.checkboxLabel(), "Create a backup before deletion");
        assert.equal(fixture.checkboxInitiallyChecked(), false);
    } finally {
        fixture.cleanup();
    }
});


test("cancelling deletion leaves the isolated local data directory unchanged", async () => {
    const fixture = setup(1);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});


test("a failed backup does not close or delete local data", async () => {
    const fixture = setup(0, true, true);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "editorial_request_failed" });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});


test("requesting a backup without a backup folder does not delete local data", async () => {
    const fixture = setup(0, true, false, undefined, false);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "editorial_request_failed" });
        assert.equal(fixture.closed(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});


test("a filesystem root is rejected without closing the application", async () => {
    const fixture = setup(0, false, false, parse(process.cwd()).root);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "invalid_request" });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});
