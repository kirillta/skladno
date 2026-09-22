import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureAuthorSkillInventory, validateAuthorSkillBackupManifest, writeAuthorSkillBackupManifest } from "./author-skill-backup-manifest.js";


const authorSkillDirectories = ["skills", "skill-history"] as const;
const restoreMarker = ".author-skills.restore-active";


export function getAuthorSkillBackupPath(snapshotPath: string): string {
    return `${snapshotPath}.skills`;
}


export function createAuthorSkillBackup({ dataDirectory, snapshotPath, expectedInventory }: { dataDirectory: string; snapshotPath: string; expectedInventory?: ReturnType<typeof captureAuthorSkillInventory> }): void {
    const destination = getAuthorSkillBackupPath(snapshotPath);
    const staged = `${destination}.tmp`;
    if (existsSync(destination) || existsSync(staged))
        throw new Error("author_skill_backup_conflict");

    const before = expectedInventory ?? captureAuthorSkillInventory(dataDirectory);
    try {
        mkdirSync(staged);
        for (const directory of authorSkillDirectories) {
            const source = join(dataDirectory, directory);
            if (existsSync(source))
                cpSync(source, join(staged, directory), { recursive: true, errorOnExist: true });
        }

        writeAuthorSkillBackupManifest(snapshotPath, staged, before, dataDirectory);
        renameSync(staged, destination);
    } catch (error) {
        rmSync(staged, { recursive: true, force: true });
        throw error;
    }
}


export function hasAuthorSkillBackup(snapshotPath: string): boolean {
    return existsSync(getAuthorSkillBackupPath(snapshotPath));
}


export function validateAuthorSkillBackup(snapshotPath: string): void {
    if (hasAuthorSkillBackup(snapshotPath))
        validateAuthorSkillBackupManifest(snapshotPath, getAuthorSkillBackupPath(snapshotPath));
}


export function applyAuthorSkillRestore({ dataDirectory, snapshotPath }: { dataDirectory: string; snapshotPath: string }): void {
    const source = getAuthorSkillBackupPath(snapshotPath);
    validateAuthorSkillBackup(snapshotPath);
    for (const directory of authorSkillDirectories) {
        const active = join(dataDirectory, directory);
        const previous = `${active}.before-restore`;
        const staged = `${active}.restore`;
        if (existsSync(previous) || existsSync(staged))
            throw new Error("author_skill_restore_conflict");
    }

    try {
        for (const directory of authorSkillDirectories) {
            const saved = join(source, directory);
            if (existsSync(saved))
                cpSync(saved, join(dataDirectory, `${directory}.restore`), { recursive: true, errorOnExist: true });
        }
    } catch (error) {
        for (const directory of authorSkillDirectories)
            rmSync(join(dataDirectory, `${directory}.restore`), { recursive: true, force: true });

        throw error;
    }

    writeFileSync(join(dataDirectory, restoreMarker), "", { flag: "wx" });
    for (const directory of authorSkillDirectories) {
        const active = join(dataDirectory, directory);
        const previous = `${active}.before-restore`;
        const staged = `${active}.restore`;
        if (existsSync(active))
            renameSync(active, previous);

        if (existsSync(staged))
            renameSync(staged, active);
    }
}


export function completeAuthorSkillRestore(dataDirectory: string): void {
    for (const directory of authorSkillDirectories) {
        rmSync(join(dataDirectory, `${directory}.before-restore`), { recursive: true, force: true });
        rmSync(join(dataDirectory, `${directory}.restore`), { recursive: true, force: true });
    }

    rmSync(join(dataDirectory, restoreMarker), { force: true });
}


export function rollbackAuthorSkillRestore(dataDirectory: string): void {
    if (!existsSync(join(dataDirectory, restoreMarker)))
        return;

    for (const directory of authorSkillDirectories) {
        const active = join(dataDirectory, directory);
        const previous = `${active}.before-restore`;
        const staged = `${active}.restore`;
        rmSync(active, { recursive: true, force: true });
        rmSync(staged, { recursive: true, force: true });
        if (existsSync(previous))
            renameSync(previous, active);
    }

    rmSync(join(dataDirectory, restoreMarker), { force: true });
}
