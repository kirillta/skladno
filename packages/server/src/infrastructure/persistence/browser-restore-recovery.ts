import { copyFileSync, cpSync, existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { validateDatabaseSnapshot } from "./database.js";


const markerName = ".browser-restore-pending.json";
const skillDirectories = ["skills", "skill-history"] as const;


function markerPath(databasePath: string): string {
    return join(dirname(databasePath), markerName);
}


export function removeDatabaseFiles(databasePath: string): void {
    for (const suffix of ["", "-wal", "-shm", "-journal"])
        rmSync(`${databasePath}${suffix}`, { force: true });
}


export function prepareBrowserRestoreRecovery(databasePath: string, recoveryDirectory: string): void {
    const name = basename(recoveryDirectory);
    if (!/^recovery-[a-zA-Z0-9_-]+$/.test(name) || dirname(recoveryDirectory) !== dirname(databasePath))
        throw new Error("invalid_restore_recovery_directory");

    validateDatabaseSnapshot(join(recoveryDirectory, "database.sqlite"));
    writeFileSync(markerPath(databasePath), JSON.stringify({ recoveryDirectory: name }), { flag: "wx" });
}


export function recoverPendingBrowserRestore(databasePath: string): boolean {
    const marker = markerPath(databasePath);
    if (!existsSync(marker))
        return false;

    const value: unknown = JSON.parse(readFileSync(marker, "utf8"));
    if (!value || typeof value !== "object" || !("recoveryDirectory" in value)
        || typeof value.recoveryDirectory !== "string" || !/^recovery-[a-zA-Z0-9_-]+$/.test(value.recoveryDirectory))
        throw new Error("invalid_restore_recovery_marker");

    const recoveryDirectory = join(dirname(databasePath), value.recoveryDirectory);
    if (!lstatSync(recoveryDirectory).isDirectory())
        throw new Error("invalid_restore_recovery_directory");

    validateDatabaseSnapshot(join(recoveryDirectory, "database.sqlite"));
    removeDatabaseFiles(databasePath);
    copyFileSync(join(recoveryDirectory, "database.sqlite"), databasePath);
    for (const name of skillDirectories) {
        const active = join(dirname(databasePath), name);
        rmSync(active, { recursive: true, force: true });
        const saved = join(recoveryDirectory, name);
        if (existsSync(saved))
            cpSync(saved, active, { recursive: true });
    }

    rmSync(marker, { force: true });
    return true;
}


export function completeBrowserRestoreRecovery(databasePath: string): void {
    rmSync(markerPath(databasePath), { force: true });
}
