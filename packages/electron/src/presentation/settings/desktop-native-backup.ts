import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { beginTimedTelemetryCapture, type TelemetryCaptureSource } from "@skladno/shared";
import { createAuthorSkillBackup, getAuthorSkillBackupPath } from "../../infrastructure/recovery/author-skill-backup.js";
import { captureAuthorSkillInventory } from "../../infrastructure/recovery/author-skill-backup-manifest.js";

export function createNativeBackup(database: { exec(sql: string): void }, dataDirectory: string, backupDirectory: string, telemetry?: TelemetryCaptureSource): { path: string; createdAt: string } {
    const observed = beginTimedTelemetryCapture(telemetry);
    let path: string | undefined;
    let temporary: string | undefined;
    let snapshotCreated = false;
    try {
        mkdirSync(backupDirectory, { recursive: true });
        const created = new Date();
        const filename = `skladno-backup-${created.toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID()}.sqlite`;
        temporary = join(backupDirectory, `.${filename}.${randomUUID()}.tmp`);
        path = join(backupDirectory, filename);
        const expectedInventory = captureAuthorSkillInventory(dataDirectory);

        database.exec(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
        renameSync(temporary, path);
        snapshotCreated = true;

        if (statSync(path).size === 0)
            throw new Error("Backup is empty.");

        createAuthorSkillBackup({ dataDirectory, snapshotPath: path, expectedInventory });
        observed.capture({ kind: "backup_finished", outcome: "completed", elapsedMs: observed.elapsedMs() });

        return { path, createdAt: created.toISOString() };
    } catch (error) {
        if (temporary)
            rmSync(temporary, { force: true });

        if (path && snapshotCreated) {
            rmSync(path, { force: true });
            rmSync(getAuthorSkillBackupPath(path), { recursive: true, force: true });
        }

        observed.capture({ kind: "backup_finished", outcome: "failed", elapsedMs: observed.elapsedMs(), failure: "unknown" });

        throw error;
    }
}
