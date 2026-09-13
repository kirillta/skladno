import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations.js";
import { chmodSync, existsSync } from "node:fs";


export type SqliteDatabase = DatabaseSync;
export type DatabaseSnapshotErrorCode = "integrity" | "foreign-keys" | "schema";


export class DatabaseSnapshotError extends Error {
    constructor(readonly code: DatabaseSnapshotErrorCode) {
        super(code);
    }
}


function snapshotRows(database: DatabaseSync, statement: string): Record<string, unknown>[] {
    return database.prepare(statement).all() as Record<string, unknown>[];
}


/** Checks an unopened backup without running migrations or changing its contents. */


export function validateDatabaseSnapshot(filename: string): void {
    let database: DatabaseSync | undefined;
    try {
        database = new DatabaseSync(filename, { readOnly: true });
        const integrity = snapshotRows(database, "PRAGMA integrity_check");
        if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok")
            throw new DatabaseSnapshotError("integrity");

        if (snapshotRows(database, "PRAGMA foreign_key_check").length > 0)
            throw new DatabaseSnapshotError("foreign-keys");

        const known = new Map<number, string>(migrations.map((migration) => [migration.version, migration.name]));
        const applied = snapshotRows(database, "SELECT version, name FROM schema_migrations ORDER BY version");
        if (applied.length === 0 || applied.some((migration) => typeof migration.version !== "number" || known.get(migration.version) !== migration.name))
            throw new DatabaseSnapshotError("schema");
    } catch (error) {
        if (error instanceof DatabaseSnapshotError)
            throw error;

        throw new DatabaseSnapshotError("integrity");
    } finally {
        database?.close();
    }
}


function restrictFilePermissions(path: string): void {
    if (process.platform !== "win32" && existsSync(path))
        chmodSync(path, 0o600);
}


function restrictDatabasePermissions(filename: string): void {
    for (const path of [filename, `${filename}-wal`, `${filename}-shm`, `${filename}-journal`])
        restrictFilePermissions(path);
}


export function openDatabase(filename: string): SqliteDatabase {
    restrictDatabasePermissions(filename);
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
