import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";


export interface RuntimeSettings {
    backupDirectory?: string;
    updateNetworkAccess?: boolean;
    automaticUpdateChecks?: boolean;
    includePrereleaseUpdates?: boolean;
    lastUpdateCheckAt?: string;
    stagedUpdateVersion?: string;
    priorVersion?: string;
    recoverySnapshotPath?: string;
    startupSuccess?: boolean;
    pendingRestore?: {
        stagedSnapshotPath: string;
        recoverySnapshotPath: string;
        phase: "ready" | "applied";
    };
}


export function readRuntimeSettings(path: string): RuntimeSettings {
    try {
        const value: unknown = JSON.parse(readFileSync(path, "utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value))
            return {};

        const record = value as Record<string, unknown>;
        return {
            ...(typeof record.backupDirectory === "string" && record.backupDirectory ? { backupDirectory: record.backupDirectory } : {}),
            ...(typeof record.updateNetworkAccess === "boolean" ? { updateNetworkAccess: record.updateNetworkAccess } : {}),
            ...(typeof record.automaticUpdateChecks === "boolean" ? { automaticUpdateChecks: record.automaticUpdateChecks } : {}),
            ...(typeof record.includePrereleaseUpdates === "boolean" ? { includePrereleaseUpdates: record.includePrereleaseUpdates } : {}),
            ...(typeof record.lastUpdateCheckAt === "string" ? { lastUpdateCheckAt: record.lastUpdateCheckAt } : {}),
            ...(typeof record.stagedUpdateVersion === "string" ? { stagedUpdateVersion: record.stagedUpdateVersion } : {}),
            ...(typeof record.priorVersion === "string" ? { priorVersion: record.priorVersion } : {}),
            ...(typeof record.recoverySnapshotPath === "string" ? { recoverySnapshotPath: record.recoverySnapshotPath } : {}),
            ...(typeof record.startupSuccess === "boolean" ? { startupSuccess: record.startupSuccess } : {}),
            ...(pendingRestore(record.pendingRestore) ? { pendingRestore: pendingRestore(record.pendingRestore) } : {}),
        };
    } catch {
        return {};
    }
}


function pendingRestore(value: unknown): RuntimeSettings["pendingRestore"] | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const record = value as Record<string, unknown>;
    if (typeof record.stagedSnapshotPath !== "string" || typeof record.recoverySnapshotPath !== "string" || (record.phase !== "ready" && record.phase !== "applied"))
        return undefined;

    return { stagedSnapshotPath: record.stagedSnapshotPath, recoverySnapshotPath: record.recoverySnapshotPath, phase: record.phase };
}


export function writeRuntimeSettings(path: string, settings: RuntimeSettings): void {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(settings), { mode: 0o600 });
    renameSync(temporary, path);
}
