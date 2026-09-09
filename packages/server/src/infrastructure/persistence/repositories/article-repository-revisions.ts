import type { ArticleRevision } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { revisionFromRow } from "./article-repository-records.js";
import type { Row } from "./repository-utils.js";


export function listArticleRevisions(database: SqliteDatabase, articleId: string): ArticleRevision[] {
    return (database.prepare("SELECT * FROM article_revisions WHERE article_id = ? ORDER BY created_at ASC, id ASC").all(articleId) as Row[]).map(revisionFromRow);
}


export function getArticleRevision(database: SqliteDatabase, articleId: string, revisionId: string): ArticleRevision | undefined {
    const row = database.prepare("SELECT * FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId) as Row | undefined;

    return row && revisionFromRow(row);
}


export function insertArticleRevision(database: SqliteDatabase, { revisionId, articleId, content, provenance, restoredFromRevisionId, timestamp }: {
    revisionId: string;
    articleId: string;
    content: string;
    provenance: Record<string, unknown>;
    restoredFromRevisionId?: string;
    timestamp: string;
}): void {
    database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, restored_from_revision_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(revisionId, articleId, content, JSON.stringify(provenance), restoredFromRevisionId ?? null, timestamp);
    database.prepare("UPDATE articles SET current_revision_id = ?, updated_at = ? WHERE id = ?")
        .run(revisionId, timestamp, articleId);
}
