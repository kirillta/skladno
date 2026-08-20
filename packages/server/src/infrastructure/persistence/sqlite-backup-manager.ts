import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BackupManager } from "../../application/ports/backup-manager.js";
import type { SqliteDatabase } from "./database.js";


function backupFilename(now: Date): string {
    const timestamp = now.toISOString().replaceAll(/[:.]/g, "-");
    return `skladno-backup-${timestamp}.sqlite`;
}


function quotedSqlPath(path: string): string {
    return path.replaceAll("'", "''");
}


export class SqliteBackupManager implements BackupManager {
    constructor(
        private readonly database: SqliteDatabase,
        private readonly now = () => new Date(),
    ) { }


    createTemporary(): { path: string; createdAt: string; cleanup(): void } {
        const destination = mkdtempSync(join(tmpdir(), "skladno-backup-"));
        if (process.platform !== "win32")
            chmodSync(destination, 0o700);

        const created = this.now();
        const path = join(destination, backupFilename(created));
        this.database.exec(`VACUUM INTO '${quotedSqlPath(path)}'`);
        if (process.platform !== "win32")
            chmodSync(path, 0o600);

        return { path, createdAt: created.toISOString(), cleanup: () => rmSync(destination, { recursive: true, force: true }) };
    }
}
