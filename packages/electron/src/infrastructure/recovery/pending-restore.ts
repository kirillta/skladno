import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { validateDatabaseSnapshot } from "@skladno/server/electron";
import { beginTelemetryCapture, type TelemetryCaptureSource } from "@skladno/shared";

import { readRuntimeSettings, updateRuntimeSettings, writeRuntimeSettings } from "../runtime/runtime-settings.js";
import type { PendingRestore } from "./pending-restore-contract.js";
import { PendingRestoreError } from "./pending-restore-error.js";
import { applyAuthorSkillRestore, completeAuthorSkillRestore, getAuthorSkillBackupPath, hasAuthorSkillBackup, rollbackAuthorSkillRestore } from "./author-skill-backup.js";


function getDatabaseSidecars(databasePath: string): string[] {
    return [`${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`];
}


function removeDatabase(databasePath: string): void {
    rmSync(databasePath, { force: true });
    for (const path of getDatabaseSidecars(databasePath))
        rmSync(path, { force: true });
}


function applyReadyRestore({ runtimePath, databasePath, pending }: { runtimePath: string; databasePath: string; pending: NonNullable<ReturnType<typeof readRuntimeSettings>["pendingRestore"]> }): void {
    const originalPath = `${databasePath}.before-restore`;
    const temporary = `${databasePath}.restore`;
    let originalMoved = false;
    let restored = false;
    let authorSkillsRestored = false;
    const dataDirectory = dirname(databasePath);
    const restoresAuthorSkills = hasAuthorSkillBackup(pending.stagedSnapshotPath);
    try {
        validateDatabaseSnapshot(pending.stagedSnapshotPath);
        validateDatabaseSnapshot(pending.recoverySnapshotPath);

        copyFileSync(pending.stagedSnapshotPath, temporary);
        validateDatabaseSnapshot(temporary);
        removeDatabase(originalPath);

        for (const path of getDatabaseSidecars(databasePath))
            rmSync(path, { force: true });

        originalMoved = existsSync(databasePath);
        if (originalMoved)
            renameSync(databasePath, originalPath);

        renameSync(temporary, databasePath);
        restored = true;
        if (restoresAuthorSkills) {
            authorSkillsRestored = true;
            applyAuthorSkillRestore({ dataDirectory, snapshotPath: pending.stagedSnapshotPath });
        }

        updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: { ...pending, phase: "applied" } }));
    } catch (error) {
        if (restored)
            removeDatabase(databasePath);

        const canRestoreOriginal = originalMoved && existsSync(originalPath);
        if (canRestoreOriginal)
            renameSync(originalPath, databasePath);

        if (authorSkillsRestored)
            rollbackAuthorSkillRestore(dataDirectory);

        updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: undefined }));
        throw new PendingRestoreError(error);
    }
}


/** Applies a validated, private staged snapshot before SQLite opens. */
export function applyPendingRestore({ runtimePath, databasePath, telemetry }: { runtimePath: string; databasePath: string; telemetry?: TelemetryCaptureSource }): PendingRestore | undefined {
    const runtime = readRuntimeSettings(runtimePath);
    const pending = runtime.pendingRestore;
    if (!pending)
        return undefined;

    const capture = beginTelemetryCapture(telemetry);
    const originalPath = `${databasePath}.before-restore`;
    const dataDirectory = dirname(databasePath);
    const restoresAuthorSkills = hasAuthorSkillBackup(pending.stagedSnapshotPath);
    try {
        if (pending.phase === "ready")
            applyReadyRestore({ runtimePath, databasePath, pending });
    } catch (error) {
        capture({ kind: "recovery_finished", recovery: "restore", outcome: "failed", failure: "persistence" });
        throw error;
    }

    return {
        complete: () => {
            removeDatabase(originalPath);
            rmSync(pending.stagedSnapshotPath, { force: true });
            rmSync(getAuthorSkillBackupPath(pending.stagedSnapshotPath), { recursive: true, force: true });
            if (restoresAuthorSkills)
                completeAuthorSkillRestore(dataDirectory);

            writeRuntimeSettings(runtimePath, { ...readRuntimeSettings(runtimePath), pendingRestore: undefined });
            capture({ kind: "recovery_finished", recovery: "restore", outcome: "completed" });
        },
        rollback: () => {
            capture({ kind: "recovery_finished", recovery: "restore", outcome: "failed", failure: "persistence" });
            validateDatabaseSnapshot(pending.recoverySnapshotPath);
            removeDatabase(databasePath);
            copyFileSync(pending.recoverySnapshotPath, databasePath);
            rmSync(pending.stagedSnapshotPath, { force: true });
            rmSync(getAuthorSkillBackupPath(pending.stagedSnapshotPath), { recursive: true, force: true });
            if (restoresAuthorSkills)
                rollbackAuthorSkillRestore(dataDirectory);

            writeRuntimeSettings(runtimePath, { ...readRuntimeSettings(runtimePath), pendingRestore: undefined });
        },
    };
}
