export interface BackupDirectoryHandle {
    name: string;
    getFileHandle(name: string, options?: { create?: boolean; }): Promise<{ getFile(): Promise<Blob>; createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; }>; }>;
    getDirectoryHandle(name: string, options?: { create?: boolean; }): Promise<BackupDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean; }): Promise<void>;
}
