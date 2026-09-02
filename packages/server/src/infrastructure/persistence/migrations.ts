export const migrations = [
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
    {
        version: 10,
        name: "assistant_proposal_recovery",
        sql: `
        ALTER TABLE assistant_messages ADD COLUMN proposal_content TEXT;
        `,
    },
    {
        version: 11,
        name: "fact_check_runs_and_resolutions",
        sql: `
        CREATE TABLE fact_check_runs (
            editorial_artifact_id TEXT PRIMARY KEY REFERENCES editorial_artifacts(id) ON DELETE CASCADE,
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            revision_id TEXT NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX fact_check_runs_article_revision ON fact_check_runs(article_id, revision_id, created_at DESC);
        CREATE TABLE fact_check_resolutions (
            occurrence_id TEXT PRIMARY KEY,
            resolution TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 12,
        name: "versioned_style_profiles",
        sql: `
        ALTER TABLE style_corpus_items ADD COLUMN included INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE style_corpus_items ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
        ALTER TABLE style_corpus_items ADD COLUMN article_id TEXT;
        ALTER TABLE style_corpus_items ADD COLUMN revision_id TEXT;
        CREATE TABLE style_corpus_settings (id INTEGER PRIMARY KEY CHECK (id = 1), rules TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
        INSERT INTO style_corpus_settings (id, rules, updated_at) VALUES (1, '', '') ON CONFLICT(id) DO NOTHING;
        CREATE TABLE style_profile_versions (version INTEGER PRIMARY KEY, profile_json TEXT NOT NULL, created_at TEXT NOT NULL);
        `,
    },
    {
        version: 13,
        name: "article_style_rules",
        sql: `
        CREATE TABLE article_style_rules (
            article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
            rules TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        `,
    },
    {
        version: 14,
        name: "assistant_capability_execution",
        sql: `
        ALTER TABLE assistant_requests ADD COLUMN capability_name TEXT;
        `,
    },
    {
        version: 15,
        name: "assistant_capability_execution_history",
        sql: `
        CREATE TABLE assistant_capability_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT NOT NULL REFERENCES assistant_requests(id) ON DELETE CASCADE,
            capability_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
            base_revision_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT
        );
        CREATE INDEX assistant_capability_executions_request_id ON assistant_capability_executions(request_id, id);
        `,
    },
    {
        version: 16,
        name: "assistant_retry_input",
        sql: `
        ALTER TABLE assistant_requests ADD COLUMN target_language TEXT;
        `,
    },
] as const;
