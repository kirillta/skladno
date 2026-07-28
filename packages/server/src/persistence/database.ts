import { DatabaseSync } from "node:sqlite";

const migrations = [
    {
        version: 1,
        name: "initial_author_data",
        sql: `
        CREATE TABLE materials (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, content TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE documents (
            id TEXT PRIMARY KEY, title TEXT NOT NULL,
            current_version_id TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE document_versions (
            id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            content TEXT NOT NULL, provenance_json TEXT NOT NULL,
            restored_from_version_id TEXT REFERENCES document_versions(id), created_at TEXT NOT NULL
        );
        CREATE INDEX document_versions_document_created ON document_versions(document_id, created_at, id);
        CREATE TABLE workflow_artifacts (
            id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            version_id TEXT NOT NULL REFERENCES document_versions(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX workflow_artifacts_document_created ON workflow_artifacts(document_id, created_at, id);
        CREATE TABLE source_citations (
            id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES workflow_artifacts(id) ON DELETE CASCADE,
            url TEXT NOT NULL, title TEXT, excerpt TEXT, uncertainty TEXT, created_at TEXT NOT NULL
        );
        CREATE INDEX source_citations_artifact_created ON source_citations(artifact_id, created_at, id);
        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 2,
        name: "editorial_sessions",
        sql: `
        CREATE TABLE editorial_sessions (
            document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
            previous_response_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        `,
    },
] as const;

export type SqliteDatabase = DatabaseSync;

export function openDatabase(filename: string): SqliteDatabase {
    const database = new DatabaseSync(filename);
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
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

        database.exec("BEGIN IMMEDIATE;");
        try {
            database.exec(migration.sql);
            database.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
                .run(migration.version, migration.name, new Date().toISOString());

            database.exec("COMMIT;");
        } catch (error) {
            database.exec("ROLLBACK;");
            throw error;
        }
    }
    
    return database;
}
