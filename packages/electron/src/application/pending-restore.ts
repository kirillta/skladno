import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";

import { validateDatabaseSnapshot } from "@skladno/server/electron";

import { readRuntimeSettings, updateRuntimeSettings, writeRuntimeSettings } from "../infrastructure/runtime-settings.js";


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


export class PendingRestoreError extends Error {
    constructor(cause: unknown) {
        super("Could not apply the pending backup restore.", { cause });
    }
}


function applyReadyRestore({ runtimePath, databasePath, pending }: { runtimePath: string; databasePath: string; pending: NonNullable<ReturnType<typeof readRuntimeSettings>["pendingRestore"]> }): void {
    const originalPath = `${databasePath}.before-restore`;
    const temporary = `${databasePath}.restore`;
    let originalMoved = false;
    let restored = false;
    try {
        validateDatabaseSnapshot(pending.stagedSnapshotPath);
        validateDatabaseSnapshot(pending.recoverySnapshotPath);

        copyFileSync(pending.stagedSnapshotPath, temporary);
        validateDatabaseSnapshot(temporary);
        removeDatabase(originalPath);

        for (const path of sidecars(databasePath))
            rmSync(path, { force: true });

        originalMoved = existsSync(databasePath);
        if (originalMoved)
            renameSync(databasePath, originalPath);

        renameSync(temporary, databasePath);
        restored = true;
        updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: { ...pending, phase: "applied" } }));
    } catch (error) {
        if (restored)
            removeDatabase(databasePath);

        const canRestoreOriginal = originalMoved && existsSync(originalPath);
        if (canRestoreOriginal)
            renameSync(originalPath, databasePath);

        updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: undefined }));
        throw new PendingRestoreError(error);
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
        applyReadyRestore({ runtimePath, databasePath, pending });

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
