import { isBuiltInSkillId, type AssistantMessage, type AssistantMessageKind, type AssistantMessageRole, type AssistantMessageStatus, type AssistantRequest, type AssistantRequestScope, type AssistantRequestStatus, type AssistantResponseKind, type AssistantSkillSource, type BuiltInSkillId } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, type Row } from "./repository-utils.js";

const roles: readonly AssistantMessageRole[] = ["assistant", "author", "system"];
const kinds: readonly AssistantMessageKind[] = ["greeting", "message", "response", "status"];
const statuses: readonly AssistantMessageStatus[] = ["completed", "pending", "failed", "cancelled"];
const requestStatuses: readonly AssistantRequestStatus[] = ["pending", "running", "completed", "failed", "cancelled"];
const skillSources: readonly AssistantSkillSource[] = ["explicit", "inferred"];


export class AssistantRepository {
    constructor(private readonly database: SqliteDatabase) { }


    ensureGreeting(articleId: string): void {
        const exists = this.database.prepare("SELECT 1 FROM assistant_messages WHERE article_id = ? AND kind = 'greeting' LIMIT 1").get(articleId);
        if (exists)
            return;

        const timestamp = now();
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
            SELECT assistant_messages.*, assistant_requests.scope_json AS request_scope_json, assistant_requests.base_revision_id AS request_base_revision_id, article_revisions.content AS request_revision_content, editorial_artifacts.content AS artifact_content
            FROM assistant_messages
            LEFT JOIN assistant_requests ON assistant_requests.id = assistant_messages.request_id
            LEFT JOIN article_revisions ON article_revisions.id = assistant_requests.base_revision_id
            LEFT JOIN editorial_artifacts ON editorial_artifacts.id = assistant_messages.editorial_artifact_id
            WHERE assistant_messages.article_id = ?
            ORDER BY assistant_messages.created_at, assistant_messages.id
        `).all(articleId) as Row[];

        return rows.map((row) => this.toMessage(row));
    }


    createRequest(input: { id: string; articleId: string; scope: AssistantRequestScope; explicitSkillId?: BuiltInSkillId; skillOffset?: number; retryOfRequestId?: string }): AssistantRequest {
        if (this.database.prepare("SELECT 1 FROM assistant_requests WHERE id = ?").get(input.id))
            throw new Error("Assistant request already exists.");

        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.database.prepare("INSERT INTO assistant_requests (id, article_id, base_revision_id, scope_json, explicit_skill_id, status, retry_of_request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(input.id, input.articleId, input.scope.baseRevisionId, JSON.stringify(input.scope), input.explicitSkillId ?? null, "running", input.retryOfRequestId ?? null, timestamp, timestamp);
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, content, skill_offset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(createId(), input.articleId, input.id, "author", "message", "completed", "", input.skillOffset ?? null, timestamp, timestamp);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getRequest(input.id)!;
    }


    setAuthorMessage(requestId: string, content: string): void {
        this.database.prepare("UPDATE assistant_messages SET content = ?, updated_at = ? WHERE request_id = ? AND role = 'author'").run(content, now(), requestId);
    }


    resolveRequest(requestId: string, skillId: BuiltInSkillId | undefined, source: AssistantSkillSource | undefined): void {
        this.database.prepare("UPDATE assistant_requests SET resolved_skill_id = ?, skill_source = ?, updated_at = ? WHERE id = ?")
            .run(skillId ?? null, source ?? null, now(), requestId);
        this.database.prepare("UPDATE assistant_messages SET skill_id = ?, updated_at = ? WHERE request_id = ? AND role = 'author'")
            .run(skillId ?? null, now(), requestId);
    }


    completeRequest(input: { requestId: string; articleId: string; skillId?: BuiltInSkillId; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string }): AssistantMessage {
        const timestamp = now();
        const messageId = createId();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, content, proposal_content, skill_id, response_kind, editorial_artifact_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(messageId, input.articleId, input.requestId, "assistant", "response", "completed", input.content, input.proposalContent ?? null, input.skillId ?? null, input.responseKind, input.editorialArtifactId ?? null, timestamp, timestamp);
            this.database.prepare("UPDATE assistant_requests SET status = 'completed', updated_at = ? WHERE id = ?").run(timestamp, input.requestId);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.toMessage(this.database.prepare("SELECT * FROM assistant_messages WHERE id = ?").get(messageId) as Row);
    }


    failRequest(requestId: string, status: "failed" | "cancelled", errorCode: string): void {
        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const request = this.getRequest(requestId);
            if (!request || request.status === "completed") {
                this.database.exec("COMMIT;");
                return;
            }

            this.database.prepare("UPDATE assistant_requests SET status = ?, error_code = ?, updated_at = ? WHERE id = ?").run(status, errorCode, timestamp, requestId);
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

        const scope = JSON.parse(String(row.scope_json)) as AssistantRequestScope;
        const status = String(row.status) as AssistantRequestStatus;
        if (!requestStatuses.includes(status) || !scope || (scope.kind !== "article" && scope.kind !== "selection"))
            throw new Error("Invalid persisted assistant request.");

        const explicitSkillValue = row.explicit_skill_id === null ? undefined : String(row.explicit_skill_id);
        const resolvedSkillValue = row.resolved_skill_id === null ? undefined : String(row.resolved_skill_id);
        const skillSource = row.skill_source === null ? undefined : String(row.skill_source) as AssistantSkillSource;
        if ((explicitSkillValue && !isBuiltInSkillId(explicitSkillValue)) || (resolvedSkillValue && !isBuiltInSkillId(resolvedSkillValue)) || (skillSource && !skillSources.includes(skillSource)))
            throw new Error("Invalid persisted assistant request.");

        const explicitSkillId = explicitSkillValue as BuiltInSkillId | undefined;
        const resolvedSkillId = resolvedSkillValue as BuiltInSkillId | undefined;

        return {
            id: String(row.id), articleId: String(row.article_id), baseRevisionId: String(row.base_revision_id), scope,
            ...(explicitSkillId ? { explicitSkillId } : {}), ...(resolvedSkillId ? { resolvedSkillId } : {}), ...(skillSource ? { skillSource } : {}), status,
            ...(row.retry_of_request_id === null ? {} : { retryOfRequestId: String(row.retry_of_request_id) }), ...(row.error_code === null ? {} : { errorCode: String(row.error_code) }),
            createdAt: String(row.created_at), updatedAt: String(row.updated_at)
        };
    }


    private toMessage(row: Row): AssistantMessage {
        const role = String(row.role) as AssistantMessageRole;
        const kind = String(row.kind) as AssistantMessageKind;
        const status = String(row.status) as AssistantMessageStatus;
        if (!roles.includes(role) || !kinds.includes(kind) || !statuses.includes(status))
            throw new Error("Invalid persisted assistant message.");

        const skillId = row.skill_id === null ? undefined : String(row.skill_id);
        if (skillId !== undefined && !isBuiltInSkillId(skillId))
            throw new Error("Invalid persisted assistant skill.");

        const skillOffset = row.skill_offset === null || row.skill_offset === undefined ? undefined : Number(row.skill_offset);
        if (skillOffset !== undefined && (!Number.isInteger(skillOffset) || skillOffset < 0))
            throw new Error("Invalid persisted assistant skill offset.");

        const requestScope = row.request_scope_json === null || row.request_scope_json === undefined
            ? undefined
            : JSON.parse(String(row.request_scope_json)) as AssistantRequestScope;

        const selectionText = role === "author" && requestScope?.kind === "selection" && typeof row.request_revision_content === "string"
            ? String(row.request_revision_content).slice(requestScope.startOffset, requestScope.endOffset)
            : undefined;
        const artifactContent = this.artifactContent(row.artifact_content);
        const proposalContent = row.proposal_content === null || row.proposal_content === undefined
            ? artifactContent?.proposal
            : String(row.proposal_content);

        return {
            id: String(row.id), articleId: String(row.article_id), ...(row.request_id === null ? {} : { requestId: String(row.request_id) }), role, kind, status,
            ...(row.content === null ? {} : { content: String(row.content) }), ...(kind === "greeting" ? { template: "greeting" as const } : {}), ...(status === "cancelled" ? { template: "request_cancelled" as const } : {}), ...(status === "failed" ? { template: "request_failed" as const } : {}), ...(skillId === undefined ? {} : { skillId }), ...(skillOffset === undefined ? {} : { skillOffset }),
            ...(selectionText ? { selectionText } : {}),
            ...(row.response_kind === null ? {} : { responseKind: String(row.response_kind) as AssistantMessage["responseKind"] }),
            ...(row.editorial_artifact_id === null ? {} : { editorialArtifactId: String(row.editorial_artifact_id) }),
            ...(row.request_base_revision_id === null || row.request_base_revision_id === undefined ? {} : { baseRevisionId: String(row.request_base_revision_id) }),
            ...(row.request_revision_content === null || row.request_revision_content === undefined ? {} : { baseRevisionContent: String(row.request_revision_content) }),
            ...(proposalContent === undefined ? {} : { proposalContent }),
            ...(artifactContent?.proposalSummaries ? { proposalSummaries: artifactContent.proposalSummaries } : {}),
            ...(artifactContent?.proposalSummaryLocale ? { proposalSummaryLocale: artifactContent.proposalSummaryLocale } : {}),
            createdAt: String(row.created_at), updatedAt: String(row.updated_at),
        };
    }


    private artifactContent(value: unknown): { proposal?: string; proposalSummaries?: import("@skladno/shared").ProposalChangeSummary[]; proposalSummaryLocale?: string } | undefined {
        if (typeof value !== "string")
            return undefined;

        try {
            const parsed = JSON.parse(value) as { proposal?: unknown; proposalSummaries?: unknown; proposalSummaryLocale?: unknown };

            return {
                ...(typeof parsed.proposal === "string" ? { proposal: parsed.proposal } : {}),
                ...(Array.isArray(parsed.proposalSummaries) ? { proposalSummaries: parsed.proposalSummaries as import("@skladno/shared").ProposalChangeSummary[] } : {}),
                ...(typeof parsed.proposalSummaryLocale === "string" ? { proposalSummaryLocale: parsed.proposalSummaryLocale } : {}),
            };
        } catch {
            return undefined;
        }
    }
}
