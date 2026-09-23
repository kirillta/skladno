export interface BackupSnapshotCreator {
    createTemporary(): { path: string; createdAt: string; cleanup(): void };
}
