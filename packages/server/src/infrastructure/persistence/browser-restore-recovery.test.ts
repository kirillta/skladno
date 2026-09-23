import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { prepareBrowserRestoreRecovery, recoverPendingBrowserRestore } from "./browser-restore-recovery.js";
import { openDatabase } from "./database.js";
import { SqliteBackupSnapshotCreator } from "./sqlite-backup-snapshot-creator.js";


test("startup rolls back an interrupted database and Skill restore", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-browser-restore-recovery-"));
    const databasePath = join(root, "skladno.sqlite");
    const database = openDatabase(databasePath);
    const recovery = join(root, "recovery-test");
    const skillPath = join(root, "skills", "clarity", "SKILL.md");
    try {
        mkdirSync(recovery);
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        writeFileSync(skillPath, "original skill");
        const snapshot = new SqliteBackupSnapshotCreator(database).createTemporary();
        copyFileSync(snapshot.path, join(recovery, "database.sqlite"));
        snapshot.cleanup();
        mkdirSync(join(recovery, "skills", "clarity"), { recursive: true });
        writeFileSync(join(recovery, "skills", "clarity", "SKILL.md"), "original skill");
        prepareBrowserRestoreRecovery(databasePath, recovery);

        database.close();
        rmSync(databasePath);
        writeFileSync(databasePath, "interrupted database");
        writeFileSync(skillPath, "interrupted skill");
        assert.equal(recoverPendingBrowserRestore(databasePath), true);
        assert.equal(readFileSync(skillPath, "utf8"), "original skill");
        assert.equal(existsSync(join(root, ".browser-restore-pending.json")), false);
        const restored = openDatabase(databasePath);
        restored.close();
        assert.equal(recoverPendingBrowserRestore(databasePath), false);
    } finally {
        try {
            database.close();
        } catch {
            // Already closed before the simulated crash.
        }

        rmSync(root, { recursive: true, force: true });
    }
});
