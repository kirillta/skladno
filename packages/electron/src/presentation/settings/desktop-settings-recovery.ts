import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, parse, relative, resolve } from "node:path";
import { validateDatabaseSnapshot } from "@skladno/server/electron";
import type { TelemetryCaptureSource } from "@skladno/shared";
import { updateRuntimeSettings } from "../../infrastructure/runtime/runtime-settings.js";
import { getAuthorSkillBackupPath, hasAuthorSkillBackup, validateAuthorSkillBackup } from "../../infrastructure/recovery/author-skill-backup.js";
import { createNativeBackup } from "./desktop-native-backup.js";


function areSettingsKeysOverlapping(first: string, second: string): boolean {
    const path = relative(resolve(first), resolve(second));
    return path === "" || (!path.startsWith("..") && !path.includes(":"));
}


function isSafeDataDirectory(path: string): boolean {
    const resolved = resolve(path);
    return resolved !== parse(resolved).root;
}


export function createLocalDataDeletion({ dataDirectory, backupDirectory, database, closeApplication, restart, telemetry }: {
    dataDirectory: string;
    backupDirectory?: string;
    database: { exec(sql: string): void };
    closeApplication(): void;
    restart(): void;
    telemetry?: TelemetryCaptureSource;
}) {
    const backupAvailable = Boolean(backupDirectory && !areSettingsKeysOverlapping(backupDirectory, dataDirectory) && !areSettingsKeysOverlapping(dataDirectory, backupDirectory));
    return {
        backupAvailable,
        execute(withBackup: boolean): "invalid_request" | "editorial_request_failed" | undefined {
            if (!isSafeDataDirectory(dataDirectory))
                return "invalid_request";

            if (withBackup) {
                if (!backupAvailable || !backupDirectory)
                    return "editorial_request_failed";

                createNativeBackup(database, dataDirectory, backupDirectory, telemetry);
            }

            closeApplication();
            rmSync(resolve(dataDirectory), { recursive: true, maxRetries: 3, retryDelay: 100 });
            restart();
        },
    };
}


export function createNativeBackupRestoration({ runtimePath, dataDirectory, backupDirectory, database, chooseBackupSnapshot, requestCheckpoint, closeApplication, restart, telemetry }: {
    runtimePath: string;
    dataDirectory: string;
    backupDirectory?: string;
    database: { exec(sql: string): void };
    chooseBackupSnapshot(directory: string): Promise<string | undefined>;
    requestCheckpoint(): Promise<boolean>;
    closeApplication(): void;
    restart(): void;
    telemetry?: TelemetryCaptureSource;
}) {
    return {
        available: Boolean(backupDirectory),
        async select() {
            if (!backupDirectory)
                return { kind: "invalid" as const };

            const selected = await chooseBackupSnapshot(backupDirectory);
            if (!selected)
                return { kind: "cancelled" as const };

            if (!areSettingsKeysOverlapping(backupDirectory, selected))
                return { kind: "invalid" as const };

            validateDatabaseSnapshot(selected);
            validateAuthorSkillBackup(selected);

            return { kind: "selected" as const, path: selected };
        },
        async execute(selected: string): Promise<"editorial_request_failed" | undefined> {
            if (!await requestCheckpoint())
                return "editorial_request_failed";

            const stagingDirectory = join(parse(runtimePath).dir, "restore-staging");
            mkdirSync(stagingDirectory, { recursive: true });
            const stagedSnapshotPath = join(stagingDirectory, `${randomUUID()}.sqlite`);
            copyFileSync(selected, stagedSnapshotPath);
            validateDatabaseSnapshot(stagedSnapshotPath);

            if (hasAuthorSkillBackup(selected))
                cpSync(getAuthorSkillBackupPath(selected), getAuthorSkillBackupPath(stagedSnapshotPath), { recursive: true, errorOnExist: true });

            validateAuthorSkillBackup(stagedSnapshotPath);
            const recoverySnapshotPath = createNativeBackup(database, dataDirectory, stagingDirectory, telemetry).path;
            updateRuntimeSettings(runtimePath, (current) => ({ ...current, pendingRestore: { stagedSnapshotPath, recoverySnapshotPath, phase: "ready" } }));
            closeApplication();

            restart();
        },
    };
}
