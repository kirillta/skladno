import { REVISION_PROVENANCE_KIND, type ArticleRevision, type AssistantEditCandidate, type AssistantRequestScope } from "@skladno/shared";

import { AssistantEditError } from "../../../application/assistant/assistant-store.js";
import type { SqliteDatabase } from "../database.js";
import { getArticleRevision, insertArticleRevision } from "./article-revision-queries.js";
import { createId, getCurrentTimestamp, type Row } from "./repository-utils.js";


function readEditRow(database: SqliteDatabase, articleId: string, messageId: string): Row {
    const row = database.prepare(`SELECT m.*, r.base_revision_id, r.scope_json, b.content AS base_content, a.current_revision_id,
        d.version AS draft_version
        FROM assistant_messages m JOIN assistant_requests r ON r.id = m.request_id
        JOIN articles a ON a.id = m.article_id
        JOIN article_revisions b ON b.id = r.base_revision_id
        LEFT JOIN article_drafts d ON d.article_id = m.article_id
        WHERE m.id = ? AND m.article_id = ? AND m.role = 'assistant'`).get(messageId, articleId) as Row | undefined;

    if (!row || !row.edit_candidate_json || row.status !== "completed")
        throw new AssistantEditError("invalid");

    return row;
}


function editContent(row: Row): { content: string; target: AssistantEditCandidate["target"] } {
    const candidate = JSON.parse(String(row.edit_candidate_json)) as AssistantEditCandidate;
    const scope = JSON.parse(String(row.scope_json)) as AssistantRequestScope;
    const base = String(row.base_content);

    if (candidate.target !== scope.kind || typeof candidate.replacement !== "string" || !candidate.replacement.trim())
        throw new AssistantEditError("invalid");

    if (candidate.target === "selection" && (scope.kind !== "selection" || candidate.original !== base.slice(scope.startOffset, scope.endOffset)))
        throw new AssistantEditError("invalid");

    const content = scope.kind === "selection"
        ? `${base.slice(0, scope.startOffset)}${candidate.replacement}${base.slice(scope.endOffset)}`
        : candidate.replacement;

    if (content === base)
        throw new AssistantEditError("invalid");

    return { content, target: candidate.target };
}


function pendingEdit(row: Row): { content: string; target: AssistantEditCandidate["target"] } {
    if (row.current_revision_id !== row.base_revision_id || row.draft_version !== null)
        throw new AssistantEditError("conflict");

    const { content, target } = editContent(row);
    return { content, target };
}


export function previewAssistantEdit(database: SqliteDatabase, articleId: string, messageId: string): { previousContent: string; content: string } | undefined {
    const row = readEditRow(database, articleId, messageId);
    if (row.applied_revision_id)
        return undefined;

    const { content } = pendingEdit(row);
    return { previousContent: String(row.base_content), content };
}


export function applyAssistantEdit(database: SqliteDatabase, articleId: string, messageId: string, description?: string): ArticleRevision {
    const row = readEditRow(database, articleId, messageId);
    if (row.applied_revision_id) {
        const applied = getArticleRevision(database, articleId, String(row.applied_revision_id));
        if (!applied)
            throw new AssistantEditError("invalid");

        return applied;
    }

    const { content, target } = pendingEdit(row);
    const revisionId = createId();
    insertArticleRevision(database, {
        revisionId,
        articleId,
        content,
        description,
        provenance: {
            kind: REVISION_PROVENANCE_KIND.ASSISTANT_EDIT,
            requestId: String(row.request_id),
            messageId,
            baseRevisionId: String(row.base_revision_id),
            target
        },
        timestamp: getCurrentTimestamp()
    });
    database.prepare("UPDATE assistant_messages SET applied_revision_id = ?, updated_at = ? WHERE id = ?").run(revisionId, getCurrentTimestamp(), messageId);

    return getArticleRevision(database, articleId, revisionId)!;
}
