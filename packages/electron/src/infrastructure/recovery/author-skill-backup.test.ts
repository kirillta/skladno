import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applyAuthorSkillRestore, completeAuthorSkillRestore, createAuthorSkillBackup, getAuthorSkillBackupPath, rollbackAuthorSkillRestore } from "./author-skill-backup.js";


test("backs up and restores Author Skills with their immutable history", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-backup-"));
    const snapshotPath = join(root, "backup.sqlite");
    try {
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        mkdirSync(join(root, "skill-history", "clarity", "revision"), { recursive: true });
        writeFileSync(join(root, "skills", "clarity", "SKILL.md"), "before");
        writeFileSync(join(root, "skill-history", "clarity", "revision", "revision.json"), "history");
        createAuthorSkillBackup({ dataDirectory: root, snapshotPath });
        writeFileSync(join(root, "skills", "clarity", "SKILL.md"), "after");

        applyAuthorSkillRestore({ dataDirectory: root, snapshotPath });
        assert.equal(readFileSync(join(root, "skills", "clarity", "SKILL.md"), "utf8"), "before");
        assert.equal(readFileSync(join(root, "skill-history", "clarity", "revision", "revision.json"), "utf8"), "history");
        completeAuthorSkillRestore(root);
        assert.equal(existsSync(join(root, "skills.before-restore")), false);
        assert.equal(existsSync(getAuthorSkillBackupPath(snapshotPath)), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("rolls Author Skills back when restored startup fails", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-rollback-"));
    const snapshotPath = join(root, "backup.sqlite");
    try {
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        writeFileSync(join(root, "skills", "clarity", "SKILL.md"), "active");
        createAuthorSkillBackup({ dataDirectory: root, snapshotPath });
        writeFileSync(join(root, "skills", "clarity", "SKILL.md"), "changed");

        applyAuthorSkillRestore({ dataDirectory: root, snapshotPath });
        rollbackAuthorSkillRestore(root);
        assert.equal(readFileSync(join(root, "skills", "clarity", "SKILL.md"), "utf8"), "changed");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
