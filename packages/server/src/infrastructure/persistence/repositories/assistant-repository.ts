import { REVISION_PROVENANCE_KIND, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantMessage, type AssistantRequest, type AssistantRequestScope, type AssistantResponseKind, type AssistantSkillSource, type RestoreAssistantCheckpointResult } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, getCurrentTimestamp, type Row } from "./repository-utils.js";
import { articleSelect, mapArticleFromRow } from "./article-record-mappers.js";
import { insertArticleRevision } from "./article-revision-queries.js";
import { AssistantCheckpointError } from "../../../application/assistant/assistant-store.js";
import { createCheckpointPreview, getCheckpointAnchor, getCheckpointTail } from "./assistant-checkpoint-queries.js";
import { getProposalAcceptances, mapAssistantMessageFromRow } from "./assistant-record-mappers.js";
import { mapAssistantRequestFromRow } from "./assistant-request-mappers.js";


function prepareCheckpointRestore(database: SqliteDatabase, articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode) {
    const anchor = getCheckpointAnchor(database, articleId, messageId);
    if (!anchor)
        throw new AssistantCheckpointError("invalid");

    const tail = getCheckpointTail(database, articleId, anchor);
    const preview = createCheckpointPreview(database, messageId, anchor, tail);
    if (preview.tailToken !== tailToken)
        throw new AssistantCheckpointError("conflict");

    const articleRow = database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row | undefined;
    if (!articleRow)
        throw new AssistantCheckpointError("invalid");

    const article = mapArticleFromRow(articleRow);
    const revisionId = anchor.base_revision_id === null ? undefined : String(anchor.base_revision_id);
    const restoreTimestamp = prepareCheckpointDraftRestore(database, articleId, article.draft, revisionId, draftMode);

    return { anchor, tail, preview, revisionId, restoreTimestamp };
}


function prepareCheckpointDraftRestore(database: SqliteDatabase, articleId: string, draft: ReturnType<typeof mapArticleFromRow>["draft"], revisionId: string | undefined, draftMode?: AssistantCheckpointDraftMode): string {
    if (revisionId && !database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId))
        throw new AssistantCheckpointError("invalid");

    let timestamp = getCurrentTimestamp();
    if (!revisionId || !draft)
        return timestamp;

    if (draftMode !== "preserve" && draftMode !== "discard")
        throw new AssistantCheckpointError("conflict");

    if (draftMode === "preserve") {
        const preservedTimestamp = getCurrentTimestamp();
        insertArticleRevision(database, { revisionId: createId(), articleId, content: draft.content, provenance: { kind: REVISION_PROVENANCE_KIND.AUTHOR_DRAFT, baseRevisionId: draft.baseRevisionId }, timestamp: preservedTimestamp });
        timestamp = new Date(Date.parse(preservedTimestamp) + 1).toISOString();
    }

    database.prepare("DELETE FROM article_drafts WHERE article_id = ?").run(articleId);
    return timestamp;
}


function removeCheckpointTail(database: SqliteDatabase, articleId: string, messageId: string, anchor: Row, tail: ReturnType<typeof getCheckpointTail>) {
    if (tail.artifactIds.length > 0) {
        const timestamp = getCurrentTimestamp();
        database.prepare(`UPDATE editorial_artifacts SET rejected_at = ? WHERE id IN (${tail.artifactIds.map(() => "?").join(",")})`).run(timestamp, ...tail.artifactIds);
    }

    database.prepare("DELETE FROM assistant_requests WHERE article_id = ? AND (created_at > ? OR (created_at = ? AND id >= ?))")
        .run(articleId, String(anchor.request_created_at), String(anchor.request_created_at), String(anchor.request_id));
    database.prepare("DELETE FROM assistant_messages WHERE article_id = ? AND request_id IS NULL AND kind <> 'greeting' AND (created_at > ? OR (created_at = ? AND id >= ?))")
        .run(articleId, String(anchor.created_at), String(anchor.created_at), messageId);
}


function appendRestoredRevision(database: SqliteDatabase, articleId: string, revisionId: string | undefined, timestamp: string) {
    if (!revisionId)
        return;

    const historical = database.prepare("SELECT content FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId) as Row;
    insertArticleRevision(database, { revisionId: createId(), articleId, content: String(historical.content), provenance: { kind: REVISION_PROVENANCE_KIND.RESTORE, restoredFromRevisionId: revisionId }, restoredFromRevisionId: revisionId, timestamp });
}


export class AssistantRepository {
    private completionDepth = 0;


    constructor(private readonly database: SqliteDatabase) { }


    ensureGreeting(articleId: string): void {
        const exists = this.database.prepare("SELECT 1 FROM assistant_messages WHERE article_id = ? AND kind = 'greeting' LIMIT 1").get(articleId);
        if (exists)
            return;

        const timestamp = getCurrentTimestamp();
        this.database.prepare("INSERT INTO assistant_messages (id, article_id, role, kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(createId(), articleId, "assistant", "greeting", "completed", timestamp, timestamp);
    }


    seedGreetings(): void {
        const articles = this.database.prepare("SELECT id FROM articles").all() as Row[];
        for (const article of articles)
            this.ensureGreeting(String(article.id));
    }


    listMessages(articleId: string): AssistantMessage[] {
        this.ensureGreeting(articleId);
        const rows = this.database.prepare(`
            SELECT assistant_messages.*, assistant_requests.scope_json AS request_scope_json, assistant_requests.skill_source AS request_skill_source, assistant_requests.base_revision_id AS request_base_revision_id, article_revisions.content AS request_revision_content, editorial_artifacts.content AS artifact_content
            FROM assistant_messages
            LEFT JOIN assistant_requests ON assistant_requests.id = assistant_messages.request_id
            LEFT JOIN article_revisions ON article_revisions.id = assistant_requests.base_revision_id
            LEFT JOIN editorial_artifacts ON editorial_artifacts.id = assistant_messages.editorial_artifact_id
            WHERE assistant_messages.article_id = ?
            ORDER BY assistant_messages.created_at, assistant_messages.id
        `).all(articleId) as Row[];

        const acceptances = getProposalAcceptances(this.database, articleId);
        return rows.map((row) => {
            const message = mapAssistantMessageFromRow(row);
            const acceptance = message.editorialArtifactId ? acceptances.get(message.editorialArtifactId) : undefined;
            return acceptance ? { ...message, proposalAcceptance: acceptance } : message;
        });
    }


    createRequest(input: { id: string; articleId: string; authorMessage?: string; scope: AssistantRequestScope; explicitSkillId?: string; skillOffset?: number; targetLanguage?: string; retryOfRequestId?: string }): AssistantRequest {
        if (this.database.prepare("SELECT 1 FROM assistant_requests WHERE id = ?").get(input.id))
            throw new Error("Assistant request already exists.");

        const timestamp = getCurrentTimestamp();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.database.prepare("INSERT INTO assistant_requests (id, article_id, base_revision_id, scope_json, explicit_skill_id, target_language, status, retry_of_request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(input.id, input.articleId, input.scope.baseRevisionId, JSON.stringify(input.scope), input.explicitSkillId ?? null, input.targetLanguage ?? null, "running", input.retryOfRequestId ?? null, timestamp, timestamp);
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, content, skill_offset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(createId(), input.articleId, input.id, "author", "message", "completed", input.authorMessage ?? "", input.skillOffset ?? null, timestamp, timestamp);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getRequest(input.id)!;
    }


    setAuthorMessage(requestId: string, content: string): void {
        this.database.prepare("UPDATE assistant_messages SET content = ?, updated_at = ? WHERE request_id = ? AND role = 'author'").run(content, getCurrentTimestamp(), requestId);
    }


    resolveRequest(requestId: string, skillId: string | undefined, source: AssistantSkillSource | undefined): void {
        this.database.prepare("UPDATE assistant_requests SET resolved_skill_id = ?, skill_source = ?, updated_at = ? WHERE id = ?")
            .run(skillId ?? null, source ?? null, getCurrentTimestamp(), requestId);
        this.database.prepare("UPDATE assistant_messages SET skill_id = ?, updated_at = ? WHERE request_id = ? AND role = 'author'")
            .run(skillId ?? null, getCurrentTimestamp(), requestId);
    }


    setExecution(requestId: string, capability: string, status: "started" | "completed" | "failed" | "cancelled" = "started"): void {
        const timestamp = getCurrentTimestamp();
        this.database.prepare("UPDATE assistant_requests SET capability_name = ?, updated_at = ? WHERE id = ?").run(capability, timestamp, requestId);
        if (status === "started") {
            this.database.prepare("INSERT INTO assistant_capability_executions (request_id, capability_name, status, base_revision_id, started_at) SELECT id, ?, 'started', base_revision_id, ? FROM assistant_requests WHERE id = ?")
                .run(capability, timestamp, requestId);
            return;
        }

        this.database.prepare("UPDATE assistant_capability_executions SET status = ?, completed_at = ? WHERE id = (SELECT id FROM assistant_capability_executions WHERE request_id = ? AND capability_name = ? AND status = 'started' ORDER BY id DESC LIMIT 1)")
            .run(status, timestamp, requestId, capability);
    }


    completeRun<T>(run: () => T): T {
        if (this.completionDepth > 0)
            return run();

        this.database.exec("BEGIN IMMEDIATE;");
        this.completionDepth += 1;
        try {
            const result = run();
            this.database.exec("COMMIT;");
            return result;
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        } finally {
            this.completionDepth -= 1;
        }
    }


    completeRequest(input: { requestId: string; articleId: string; skillId?: string; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string }): AssistantMessage {
        const timestamp = getCurrentTimestamp();
        const messageId = createId();
        return this.completeRun(() => {
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, content, proposal_content, skill_id, response_kind, editorial_artifact_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(messageId, input.articleId, input.requestId, "assistant", "response", "completed", input.content, input.proposalContent ?? null, input.skillId ?? null, input.responseKind, input.editorialArtifactId ?? null, timestamp, timestamp);
            this.database.prepare("UPDATE assistant_requests SET status = 'completed', updated_at = ? WHERE id = ?").run(timestamp, input.requestId);
            return mapAssistantMessageFromRow(this.database.prepare("SELECT * FROM assistant_messages WHERE id = ?").get(messageId) as Row);
        });
    }


    rejectTranslation(articleId: string, editorialArtifactId: string): boolean {
        return this.database.prepare("UPDATE assistant_messages SET status = 'rejected', updated_at = ? WHERE article_id = ? AND editorial_artifact_id = ? AND response_kind = 'translation_proposal_prepared' AND status = 'completed'")
            .run(getCurrentTimestamp(), articleId, editorialArtifactId).changes > 0;
    }


    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview {
        const anchor = getCheckpointAnchor(this.database, articleId, messageId);
        if (!anchor)
            throw new AssistantCheckpointError("invalid");

        const tail = getCheckpointTail(this.database, articleId, anchor);
        return createCheckpointPreview(this.database, messageId, anchor, tail);
    }


    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const state = prepareCheckpointRestore(this.database, articleId, messageId, tailToken, draftMode);
            removeCheckpointTail(this.database, articleId, messageId, state.anchor, state.tail);
            appendRestoredRevision(this.database, articleId, state.revisionId, state.restoreTimestamp);

            const restoredArticle = mapArticleFromRow(this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row);
            const messages = this.listMessages(articleId);
            this.database.exec("COMMIT;");

            return { messages, article: restoredArticle, composer: state.preview.composer };
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }


    failRequest(requestId: string, status: "failed" | "cancelled", errorCode: string): void {
        const timestamp = getCurrentTimestamp();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const request = this.getRequest(requestId);
            if (!request || request.status === "completed") {
                this.database.exec("COMMIT;");
                return;
            }

            this.database.prepare("UPDATE assistant_requests SET status = ?, error_code = ?, updated_at = ? WHERE id = ?").run(status, errorCode, timestamp, requestId);
            this.database.prepare("UPDATE assistant_capability_executions SET status = ?, completed_at = ? WHERE request_id = ? AND status = 'started'").run(status, timestamp, requestId);
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, created_at, updated_at) SELECT ?, article_id, id, 'assistant', 'status', ?, ?, ? FROM assistant_requests WHERE id = ? AND NOT EXISTS (SELECT 1 FROM assistant_messages WHERE request_id = ? AND kind = 'status')")
                .run(createId(), status, timestamp, timestamp, requestId, requestId);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }


    getRequest(requestId: string): AssistantRequest | undefined {
        const row = this.database.prepare("SELECT * FROM assistant_requests WHERE id = ?").get(requestId) as Row | undefined;
        if (!row)
            return undefined;

        return mapAssistantRequestFromRow(this.database, row);
    }
}
