import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BackupBundleTransfers } from "./backup-bundle.js";
import { openDatabase } from "./database.js";
import { SqliteBackupManager } from "./sqlite-backup-manager.js";


test("exports and imports a database with current and deleted Skill history", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-bundle-roundtrip-"));
    const database = openDatabase(join(root, "skladno.sqlite"));
    const revision = join(root, "skill-history", "deleted", "revision-1");
    const installed = join(root, "skills", "current");
    let restored = false;
    try {
        mkdirSync(revision, { recursive: true });
        mkdirSync(installed, { recursive: true });
        writeFileSync(join(revision, "SKILL.md"), "deleted history");
        writeFileSync(join(installed, "SKILL.md"), "current skill");
        const manager = new SqliteBackupManager(database);
        const transfers = new BackupBundleTransfers(root, () => manager.createTemporary(), async (directory) => {
            assert.equal(readFileSync(join(directory, "skills", "current", "SKILL.md"), "utf8"), "current skill");
            assert.equal(readFileSync(join(directory, "skill-history", "deleted", "revision-1", "SKILL.md"), "utf8"), "deleted history");
            restored = true;
        });
        const { id, manifest } = transfers.createExport();
        assert.deepEqual(manifest.files.map((file) => file.path), [
            "database.sqlite", "skill-history/deleted/revision-1/SKILL.md", "skills/current/SKILL.md",
        ]);

        const imported = transfers.beginImport(manifest);
        for (const [index] of manifest.files.entries())
            transfers.writeImport(imported, index, transfers.readExport(id, index));

        await transfers.restoreImport(imported);
        transfers.remove(id);
        assert.equal(restored, true);
    } finally {
        database.close();
        rmSync(root, { recursive: true, force: true });
    }
});


test("rejects a modified bundle before restoring", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-bundle-integrity-"));
    const database = openDatabase(join(root, "skladno.sqlite"));
    let restored = false;
    try {
        const manager = new SqliteBackupManager(database);
        const transfers = new BackupBundleTransfers(root, () => manager.createTemporary(), async () => {
            restored = true;
        });
        const { id, manifest } = transfers.createExport();
        const imported = transfers.beginImport(manifest);
        const changed = Buffer.from(transfers.readExport(id, 0));
        changed[0] = changed[0] === 0 ? 1 : 0;
        assert.throws(() => transfers.writeImport(imported, 0, changed), /backup_bundle_invalid_file/);
        await assert.rejects(transfers.restoreImport(imported));
        assert.equal(restored, false);
        transfers.remove(id);
    } finally {
        database.close();
        rmSync(root, { recursive: true, force: true });
    }
});


test("rejects a browser bundle beyond the transfer limit", () => {
    const transfers = new BackupBundleTransfers("unused", () => {
        throw new Error("unused");
    }, async () => undefined);
    assert.throws(() => transfers.beginImport({
        format: 1,
        files: [{ path: "database.sqlite", size: 100_000_001, sha256: "0".repeat(64) }],
    }), /backup_bundle_invalid_manifest/);
});
