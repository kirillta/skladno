import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "./database.js";
import { SqliteBackupManager } from "./sqlite-backup-manager.js";


// product: settings.backup-policy-human-reviewed
test("creates a restorable temporary snapshot", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-backup-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    database.prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)").run("test", JSON.stringify({ article: "private" }), "2026-08-18T00:00:00.000Z");

    try {
        const backup = new SqliteBackupManager(database, () => new Date("2026-08-18T00:00:00.000Z")).createTemporary();
        const restored = openDatabase(backup.path);
        try {
            assert.deepEqual(JSON.parse(String(restored.prepare("SELECT value_json FROM app_settings WHERE key = 'test'").get()?.value_json)), { article: "private" });
        } finally {
            restored.close();
            backup.cleanup();
        }
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
