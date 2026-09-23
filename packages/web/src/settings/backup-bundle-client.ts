import type { BackupBundleManifest } from "@skladno/shared";


export interface BackupBundleClient {
    createBackupExport?: () => Promise<{ id: string; manifest: BackupBundleManifest; }>;
    readBackupExport?: (id: string, index: number) => Promise<Blob>;
    removeBackupExport?: (id: string) => Promise<void>;
    beginBackupImport?: (manifest: BackupBundleManifest) => Promise<{ id: string; }>;
    writeBackupImport?: (id: string, index: number, file: Blob) => Promise<void>;
    restoreBackupImport?: (id: string) => Promise<void>;
    removeBackupImport?: (id: string) => Promise<void>;
}
