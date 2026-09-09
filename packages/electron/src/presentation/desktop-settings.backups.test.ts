import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { setup } from "./desktop-settings.test-utils.js";

test("a separate backup folder with snapshots and unrelated files can be reused", async () => {
    const fixture = setup(0, false, false, undefined, true, ({ root }) => join(root, "existing-backups"));
    const selectedDirectory = join(fixture.root, "existing-backups");
    mkdirSync(selectedDirectory);
    writeFileSync(join(selectedDirectory, "skladno-backup-2026-01-01.sqlite"), "existing backup");
    writeFileSync(join(selectedDirectory, "keep.txt"), "unrelated");
    try {
        assert.deepEqual(await fixture.invokeChooseBackupDirectory(), { ok: true, value: selectedDirectory });
        await fixture.invokeCreateBackup();
        assert.equal(readdirSync(selectedDirectory).filter((file) => file.endsWith(".sqlite")).length, 2);
        assert.equal(readFileSync(join(selectedDirectory, "keep.txt"), "utf8"), "unrelated");
        assert.equal(JSON.parse(readFileSync(join(fixture.root, "user-data", "runtime-settings.json"), "utf8")).backupDirectory, selectedDirectory);
        assert.equal(fixture.telemetry().length, 1);
        const [event] = fixture.telemetry();
        if (!event || event.kind !== "backup_finished")
            assert.fail("Expected a backup telemetry event.");

        assert.equal(event.outcome, "completed");
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
