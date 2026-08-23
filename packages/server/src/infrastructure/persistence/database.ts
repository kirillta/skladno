import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations.js";
import { chmodSync, existsSync, unlinkSync } from "node:fs";


export type SqliteDatabase = DatabaseSync;


function restrictFilePermissions(path: string): void {
    if (process.platform !== "win32" && existsSync(path))
        chmodSync(path, 0o600);
}


function restrictDatabasePermissions(filename: string): void {
    for (const path of [filename, `${filename}-wal`, `${filename}-shm`, `${filename}-journal`])
        restrictFilePermissions(path);
}


function isLegacyDatabase(filename: string): boolean {
    if (!existsSync(filename))
        return false;

    const database = new DatabaseSync(filename);
    try {
        const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('documents', 'schema_migrations')").all() as { name: string }[];
        if (rows.some((row) => row.name === "documents"))
            return true;

        return rows.some((row) => row.name === "schema_migrations") && Boolean(database.prepare("SELECT 1 FROM schema_migrations WHERE name IN ('initial_author_data', 'translation_document_links', 'document_creation_metadata') LIMIT 1").get());
    } finally {
        database.close();
    }
}


function removeLegacyDatabase(filename: string): void {
    for (const path of [filename, `${filename}-wal`, `${filename}-shm`, `${filename}-journal`]) {
        if (!existsSync(path))
            continue;

        try {
            unlinkSync(path);
        } catch (error) {
            const detail = error instanceof Error ? error.message : "unknown error";
            throw new Error(`Could not remove legacy Skladno database at ${path}: ${detail}`, {
                cause: error,
            });
        }
    }
}


export function openDatabase(filename: string): SqliteDatabase {
    restrictDatabasePermissions(filename);
    if (isLegacyDatabase(filename))
        removeLegacyDatabase(filename);

    const database = new DatabaseSync(filename);
    restrictDatabasePermissions(filename);
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    database.exec("BEGIN IMMEDIATE;");
    try {
        database.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
            );
        `);
        const applied = new Set(
            database.prepare("SELECT version FROM schema_migrations ORDER BY version")
                .all()
                .map((row) => Number(row.version)),
        );

        for (const migration of migrations) {
            if (applied.has(migration.version))
                continue;

            database.exec(migration.sql);
            database.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
                .run(migration.version, migration.name, new Date().toISOString());
        }

        database.exec("COMMIT;");
    } catch (error) {
        database.exec("ROLLBACK;");
        throw error;
    }

    restrictDatabasePermissions(filename);
    return database;
}
