import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";

import { validateDatabaseSnapshot } from "@skladno/server/electron";

import { readRuntimeSettings, writeRuntimeSettings } from "../infrastructure/runtime-settings.js";


function sidecars(databasePath: string): string[] {
    return [`${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`];
}


function removeDatabase(databasePath: string): void {
    rmSync(databasePath, { force: true });
    for (const path of sidecars(databasePath))
        rmSync(path, { force: true });
}


export interface PendingRestore {
    complete(): void;
    rollback(): void;
}


function applyReadyRestore({ runtimePath, databasePath, runtime, pending }: { runtimePath: string; databasePath: string; runtime: ReturnType<typeof readRuntimeSettings>; pending: NonNullable<ReturnType<typeof readRuntimeSettings>["pendingRestore"]> }): void {
    const originalPath = `${databasePath}.before-restore`;
    try {
        validateDatabaseSnapshot(pending.stagedSnapshotPath);
        validateDatabaseSnapshot(pending.recoverySnapshotPath);

        const temporary = `${databasePath}.restore`;
        copyFileSync(pending.stagedSnapshotPath, temporary);
        validateDatabaseSnapshot(temporary);
        removeDatabase(originalPath);

        for (const path of sidecars(databasePath))
            rmSync(path, { force: true });

        if (existsSync(databasePath))
            renameSync(databasePath, originalPath);

        renameSync(temporary, databasePath);
        writeRuntimeSettings(runtimePath, { ...runtime, pendingRestore: { ...pending, phase: "applied" } });
    } catch (error) {
        removeDatabase(databasePath);
        if (existsSync(originalPath))
            renameSync(originalPath, databasePath);

        writeRuntimeSettings(runtimePath, { ...runtime, pendingRestore: undefined });
        throw error;
    }
}


/** Applies a validated, private staged snapshot before SQLite opens. */
export function applyPendingRestore({ runtimePath, databasePath }: { runtimePath: string; databasePath: string }): PendingRestore | undefined {
    const runtime = readRuntimeSettings(runtimePath);
    const pending = runtime.pendingRestore;
    if (!pending)
        return undefined;

    const originalPath = `${databasePath}.before-restore`;
    if (pending.phase === "ready")
        applyReadyRestore({ runtimePath, databasePath, runtime, pending });

    return {
        complete: () => {
            removeDatabase(originalPath);
            rmSync(pending.stagedSnapshotPath, { force: true });
            writeRuntimeSettings(runtimePath, { ...readRuntimeSettings(runtimePath), pendingRestore: undefined });
        },
        rollback: () => {
            validateDatabaseSnapshot(pending.recoverySnapshotPath);
            removeDatabase(databasePath);
            copyFileSync(pending.recoverySnapshotPath, databasePath);
            rmSync(pending.stagedSnapshotPath, { force: true });
            writeRuntimeSettings(runtimePath, { ...readRuntimeSettings(runtimePath), pendingRestore: undefined });
        },
    };
}
