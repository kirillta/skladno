export interface BackupManager {
    createTemporary(): { path: string; createdAt: string; cleanup(): void };
}
