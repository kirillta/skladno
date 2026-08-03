import { DatabaseSync } from "node:sqlite";
import { existsSync, unlinkSync } from "node:fs";

const migrations = [
    {
        version: 1,
        name: "article_workspace",
        sql: `
        CREATE TABLE author_materials (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, content TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE articles (
            id TEXT PRIMARY KEY, title TEXT NOT NULL,
            current_revision_id TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE article_revisions (
            id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            content TEXT NOT NULL, provenance_json TEXT NOT NULL,
            restored_from_revision_id TEXT REFERENCES article_revisions(id), created_at TEXT NOT NULL
        );
        CREATE INDEX article_revisions_article_created ON article_revisions(article_id, created_at, id);
        CREATE TABLE editorial_artifacts (
            id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            revision_id TEXT NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX editorial_artifacts_article_created ON editorial_artifacts(article_id, created_at, id);
        CREATE TABLE source_citations (
            id TEXT PRIMARY KEY, editorial_artifact_id TEXT NOT NULL REFERENCES editorial_artifacts(id) ON DELETE CASCADE,
            url TEXT NOT NULL, title TEXT, excerpt TEXT, uncertainty TEXT, created_at TEXT NOT NULL
        );
        CREATE INDEX source_citations_editorial_artifact_created ON source_citations(editorial_artifact_id, created_at, id);
        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 2,
        name: "editorial_sessions_article",
        sql: `
        CREATE TABLE editorial_sessions (
            article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
            previous_response_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 3,
        name: "style_corpus_profiles",
        sql: `
        CREATE TABLE style_corpus_items (
            author_material_id TEXT PRIMARY KEY REFERENCES author_materials(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE style_profiles (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            profile_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 4,
        name: "translation_article_links",
        sql: `
        ALTER TABLE articles ADD COLUMN language TEXT;
        ALTER TABLE articles ADD COLUMN source_article_id TEXT REFERENCES articles(id) ON DELETE SET NULL;
        ALTER TABLE articles ADD COLUMN source_revision_id TEXT REFERENCES article_revisions(id) ON DELETE SET NULL;
        CREATE INDEX articles_source_article ON articles(source_article_id);
        `,
    },
    {
        version: 5,
        name: "article_creation_metadata",
        sql: `
        ALTER TABLE articles ADD COLUMN audience TEXT;
        ALTER TABLE articles ADD COLUMN publishing_profile_id TEXT;
        `,
    },
    {
        version: 6,
        name: "article_workflow_stage",
        sql: `
        ALTER TABLE articles ADD COLUMN workflow_stage TEXT NOT NULL DEFAULT 'talking_points';
        `,
    },
    {
        version: 7,
        name: "article_drafts",
        sql: `
        CREATE TABLE article_drafts (
            article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            base_revision_id TEXT NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
            version INTEGER NOT NULL CHECK (version > 0),
            updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 8,
        name: "assistant_conversations",
        sql: `
        CREATE TABLE assistant_requests (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            base_revision_id TEXT NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
            scope_json TEXT NOT NULL,
            explicit_skill_id TEXT,
            resolved_skill_id TEXT,
            skill_source TEXT,
            status TEXT NOT NULL,
            retry_of_request_id TEXT REFERENCES assistant_requests(id) ON DELETE SET NULL,
            error_code TEXT,
            error_parameters_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX assistant_requests_article_created ON assistant_requests(article_id, created_at, id);
        CREATE TABLE assistant_messages (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            request_id TEXT REFERENCES assistant_requests(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            content TEXT,
            skill_id TEXT,
            response_kind TEXT,
            editorial_artifact_id TEXT REFERENCES editorial_artifacts(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX assistant_messages_article_created ON assistant_messages(article_id, created_at, id);
        `,
    },
    {
        version: 9,
        name: "assistant_message_skill_offsets",
        sql: `
        ALTER TABLE assistant_messages ADD COLUMN skill_offset INTEGER;
        `,
    },
] as const;

export type SqliteDatabase = DatabaseSync;


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
    if (isLegacyDatabase(filename))
        removeLegacyDatabase(filename);

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
