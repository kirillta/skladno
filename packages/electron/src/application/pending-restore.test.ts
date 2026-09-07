import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "@skladno/server/electron";

import { writeRuntimeSettings } from "../infrastructure/runtime-settings.js";
import { applyPendingRestore } from "./pending-restore.js";


function writeSetting(path: string, value: string): void {
    const database = openDatabase(path);
    try {
        database.prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)").run("restore-test", JSON.stringify(value), "2026-09-06T00:00:00.000Z");
    } finally {
        database.close();
    }
}


function readSetting(path: string): string {
    const database = openDatabase(path);
    try {
        return JSON.parse(String(database.prepare("SELECT value_json FROM app_settings WHERE key = 'restore-test'").get()?.value_json));
    } finally {
        database.close();
    }
}


// product: settings.restore-local-backup
test("staged restoration replaces active data only until a rollback is needed", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-restore-"));
    const databasePath = join(root, "skladno.sqlite");
    const stagedSnapshotPath = join(root, "selected.sqlite");
    const recoverySnapshotPath = join(root, "recovery.sqlite");
    const runtimePath = join(root, "runtime-settings.json");
    writeSetting(databasePath, "active");
    copyFileSync(databasePath, recoverySnapshotPath);
    writeSetting(stagedSnapshotPath, "restored");
    writeRuntimeSettings(runtimePath, { pendingRestore: { stagedSnapshotPath, recoverySnapshotPath, phase: "ready" } });

    try {
        const restore = applyPendingRestore({ runtimePath, databasePath });
        assert.ok(restore);
        assert.equal(readSetting(databasePath), "restored");
        restore.rollback();
        assert.equal(readSetting(databasePath), "active");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("successful restoration removes only the staged backup", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-restore-"));
    const databasePath = join(root, "skladno.sqlite");
    const stagedSnapshotPath = join(root, "selected.sqlite");
    const recoverySnapshotPath = join(root, "recovery.sqlite");
    const runtimePath = join(root, "runtime-settings.json");
    writeSetting(databasePath, "active");
    copyFileSync(databasePath, recoverySnapshotPath);
    writeSetting(stagedSnapshotPath, "restored");
    writeRuntimeSettings(runtimePath, { pendingRestore: { stagedSnapshotPath, recoverySnapshotPath, phase: "ready" } });

    try {
        const restore = applyPendingRestore({ runtimePath, databasePath });
        assert.ok(restore);
        restore.complete();
        assert.equal(readSetting(databasePath), "restored");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
