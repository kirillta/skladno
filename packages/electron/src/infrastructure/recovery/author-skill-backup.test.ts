import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applyAuthorSkillRestore, completeAuthorSkillRestore, createAuthorSkillBackup, getAuthorSkillBackupPath, rollbackAuthorSkillRestore, validateAuthorSkillBackup } from "./author-skill-backup.js";
import { captureAuthorSkillInventory } from "./author-skill-backup-manifest.js";


test("backs up and restores Author Skills with their immutable history", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-backup-"));
    const snapshotPath = join(root, "backup.sqlite");
    try {
        writeFileSync(snapshotPath, "database");
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
        writeFileSync(snapshotPath, "database");
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


test("restores revised Skill content and history after deletion", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-revision-backup-"));
    const snapshotPath = join(root, "backup.sqlite");
    const skillPath = join(root, "skills", "clarity", "SKILL.md");
    const historyPath = join(root, "skill-history", "clarity");
    try {
        writeFileSync(snapshotPath, "database");
        mkdirSync(join(historyPath, "revision-1"), { recursive: true });
        mkdirSync(join(historyPath, "revision-2"), { recursive: true });
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        writeFileSync(skillPath, "restored revision");
        writeFileSync(join(historyPath, "revision-1", "SKILL.md"), "original revision");
        writeFileSync(join(historyPath, "revision-2", "SKILL.md"), "restored revision");
        createAuthorSkillBackup({ dataDirectory: root, snapshotPath });

        rmSync(join(root, "skills", "clarity"), { recursive: true });
        applyAuthorSkillRestore({ dataDirectory: root, snapshotPath });
        assert.equal(readFileSync(skillPath, "utf8"), "restored revision");
        assert.equal(readFileSync(join(historyPath, "revision-1", "SKILL.md"), "utf8"), "original revision");
        assert.equal(readFileSync(join(historyPath, "revision-2", "SKILL.md"), "utf8"), "restored revision");
        completeAuthorSkillRestore(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("keeps deleted Skill history in a backup", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-deleted-skill-backup-"));
    const snapshotPath = join(root, "backup.sqlite");
    const historyPath = join(root, "skill-history", "clarity", "revision-1", "SKILL.md");
    try {
        writeFileSync(snapshotPath, "database");
        mkdirSync(join(root, "skill-history", "clarity", "revision-1"), { recursive: true });
        writeFileSync(historyPath, "original revision");
        createAuthorSkillBackup({ dataDirectory: root, snapshotPath });
        rmSync(join(root, "skill-history"), { recursive: true });

        applyAuthorSkillRestore({ dataDirectory: root, snapshotPath });
        assert.equal(existsSync(join(root, "skills", "clarity")), false);
        assert.equal(readFileSync(historyPath, "utf8"), "original revision");
        completeAuthorSkillRestore(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("rejects a backup with changed Skill content before restore", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skill-backup-integrity-"));
    const snapshotPath = join(root, "backup.sqlite");
    try {
        writeFileSync(snapshotPath, "database");
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        writeFileSync(join(root, "skills", "clarity", "SKILL.md"), "original");
        createAuthorSkillBackup({ dataDirectory: root, snapshotPath });
        writeFileSync(join(getAuthorSkillBackupPath(snapshotPath), "skills", "clarity", "SKILL.md"), "tampered");

        assert.throws(() => validateAuthorSkillBackup(snapshotPath), /author_skill_backup_invalid_manifest/);
        assert.throws(() => applyAuthorSkillRestore({ dataDirectory: root, snapshotPath }), /author_skill_backup_invalid_manifest/);
        assert.equal(readFileSync(join(root, "skills", "clarity", "SKILL.md"), "utf8"), "original");

        rmSync(join(getAuthorSkillBackupPath(snapshotPath), "manifest.json"));
        assert.throws(() => validateAuthorSkillBackup(snapshotPath), /author_skill_backup_invalid_manifest/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("fails backup creation when Skill files change during capture", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skill-backup-conflict-"));
    const snapshotPath = join(root, "backup.sqlite");
    try {
        writeFileSync(snapshotPath, "database");
        mkdirSync(join(root, "skills", "clarity"), { recursive: true });
        const skillPath = join(root, "skills", "clarity", "SKILL.md");
        writeFileSync(skillPath, "before");
        const expectedInventory = captureAuthorSkillInventory(root);
        writeFileSync(skillPath, "after");

        assert.throws(() => createAuthorSkillBackup({ dataDirectory: root, snapshotPath, expectedInventory }), /author_skill_backup_changed/);
        assert.equal(existsSync(getAuthorSkillBackupPath(snapshotPath)), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
