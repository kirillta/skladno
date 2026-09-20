import { createHash } from "node:crypto";
import { REVISION_PROVENANCE_KIND, resolveBuiltInSkillId, type AssistantCapabilityExecution, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantMessage, type AssistantMessageKind, type AssistantMessageRole, type AssistantMessageStatus, type AssistantRequest, type AssistantRequestScope, type AssistantRequestStatus, type AssistantResponseKind, type AssistantSkillSource, type BuiltInSkillId, type ProposalAcceptance, type RestoreAssistantCheckpointResult } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, getCurrentTimestamp, parseObject, type Row } from "./repository-utils.js";
import { articleSelect, mapArticleFromRow } from "./article-record-mappers.js";
import { insertArticleRevision } from "./article-revision-queries.js";
import { AssistantCheckpointError } from "../../../application/assistant/assistant-store.js";

const roles: readonly AssistantMessageRole[] = ["assistant", "author", "system"];
const kinds: readonly AssistantMessageKind[] = ["greeting", "message", "response", "status"];
const statuses: readonly AssistantMessageStatus[] = ["completed", "pending", "failed", "cancelled", "rejected"];
const requestStatuses: readonly AssistantRequestStatus[] = ["pending", "running", "completed", "failed", "cancelled"];
const skillSources: readonly AssistantSkillSource[] = ["explicit", "inferred"];


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

        const acceptances = this.getProposalAcceptances(articleId);
        return rows.map((row) => {
            const message = this.mapMessageFromRow(row);
            const acceptance = message.editorialArtifactId ? acceptances.get(message.editorialArtifactId) : undefined;
            return acceptance ? { ...message, proposalAcceptance: acceptance } : message;
        });
    }


    createRequest(input: { id: string; articleId: string; authorMessage?: string; scope: AssistantRequestScope; explicitSkillId?: BuiltInSkillId; skillOffset?: number; targetLanguage?: string; retryOfRequestId?: string }): AssistantRequest {
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


    resolveRequest(requestId: string, skillId: BuiltInSkillId | undefined, source: AssistantSkillSource | undefined): void {
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


    completeRequest(input: { requestId: string; articleId: string; skillId?: BuiltInSkillId; responseKind: AssistantResponseKind; content: string; proposalContent?: string; editorialArtifactId?: string }): AssistantMessage {
        const timestamp = getCurrentTimestamp();
        const messageId = createId();
        return this.completeRun(() => {
            this.database.prepare("INSERT INTO assistant_messages (id, article_id, request_id, role, kind, status, content, proposal_content, skill_id, response_kind, editorial_artifact_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(messageId, input.articleId, input.requestId, "assistant", "response", "completed", input.content, input.proposalContent ?? null, input.skillId ?? null, input.responseKind, input.editorialArtifactId ?? null, timestamp, timestamp);
            this.database.prepare("UPDATE assistant_requests SET status = 'completed', updated_at = ? WHERE id = ?").run(timestamp, input.requestId);
            return this.mapMessageFromRow(this.database.prepare("SELECT * FROM assistant_messages WHERE id = ?").get(messageId) as Row);
        });
    }


    rejectTranslation(articleId: string, editorialArtifactId: string): boolean {
        return this.database.prepare("UPDATE assistant_messages SET status = 'rejected', updated_at = ? WHERE article_id = ? AND editorial_artifact_id = ? AND response_kind = 'translation_proposal_prepared' AND status = 'completed'")
            .run(getCurrentTimestamp(), articleId, editorialArtifactId).changes > 0;
    }


    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview {
        const anchor = this.getCheckpointAnchor(articleId, messageId);
        if (!anchor)
            throw new AssistantCheckpointError("invalid");

        const tail = this.getCheckpointTail(articleId, anchor);
        return this.createCheckpointPreview(messageId, anchor, tail);
    }


    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const anchor = this.getCheckpointAnchor(articleId, messageId);
            if (!anchor)
                throw new AssistantCheckpointError("invalid");

            const tail = this.getCheckpointTail(articleId, anchor);
            const preview = this.createCheckpointPreview(messageId, anchor, tail);
            if (preview.tailToken !== tailToken)
                throw new AssistantCheckpointError("conflict");

            const articleRow = this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row | undefined;
            if (!articleRow)
                throw new AssistantCheckpointError("invalid");

            const article = mapArticleFromRow(articleRow);
            const revisionId = anchor.base_revision_id === null ? undefined : String(anchor.base_revision_id);
            let restoreTimestamp = getCurrentTimestamp();
            if (revisionId && !this.database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId))
                throw new AssistantCheckpointError("invalid");

            if (revisionId && article.draft) {
                if (draftMode !== "preserve" && draftMode !== "discard")
                    throw new AssistantCheckpointError("conflict");

                if (draftMode === "preserve") {
                    const preservedTimestamp = getCurrentTimestamp();
                    insertArticleRevision(this.database, { revisionId: createId(), articleId, content: article.draft.content, provenance: { kind: REVISION_PROVENANCE_KIND.AUTHOR_DRAFT, baseRevisionId: article.draft.baseRevisionId }, timestamp: preservedTimestamp });
                    restoreTimestamp = new Date(Date.parse(preservedTimestamp) + 1).toISOString();
                }

                this.database.prepare("DELETE FROM article_drafts WHERE article_id = ?").run(articleId);
            }

            const timestamp = getCurrentTimestamp();
            if (tail.artifactIds.length > 0)
                this.database.prepare(`UPDATE editorial_artifacts SET rejected_at = ? WHERE id IN (${tail.artifactIds.map(() => "?").join(",")})`).run(timestamp, ...tail.artifactIds);

            this.database.prepare("DELETE FROM assistant_requests WHERE article_id = ? AND (created_at > ? OR (created_at = ? AND id >= ?))")
                .run(articleId, String(anchor.request_created_at), String(anchor.request_created_at), String(anchor.request_id));
            this.database.prepare("DELETE FROM assistant_messages WHERE article_id = ? AND request_id IS NULL AND kind <> 'greeting' AND (created_at > ? OR (created_at = ? AND id >= ?))")
                .run(articleId, String(anchor.created_at), String(anchor.created_at), messageId);

            if (revisionId) {
                const historical = this.database.prepare("SELECT content FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId) as Row;
                insertArticleRevision(this.database, { revisionId: createId(), articleId, content: String(historical.content), provenance: { kind: REVISION_PROVENANCE_KIND.RESTORE, restoredFromRevisionId: revisionId }, restoredFromRevisionId: revisionId, timestamp: restoreTimestamp });
            }

            const restoredArticle = mapArticleFromRow(this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row);
            const messages = this.listMessages(articleId);
            this.database.exec("COMMIT;");

            return { messages, article: restoredArticle, composer: preview.composer };
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }


    private getCheckpointAnchor(articleId: string, messageId: string): Row | undefined {
        return this.database.prepare(`SELECT m.*, r.id request_id, r.created_at request_created_at, r.base_revision_id, r.scope_json, r.explicit_skill_id, r.resolved_skill_id, r.target_language
            FROM assistant_messages m JOIN assistant_requests r ON r.id = m.request_id
            WHERE m.id = ? AND m.article_id = ? AND m.role = 'author' AND m.kind = 'message'`).get(messageId, articleId) as Row | undefined;
    }


    private getCheckpointTail(articleId: string, anchor: Row) {
        const requests = this.database.prepare("SELECT id, retry_of_request_id, updated_at FROM assistant_requests WHERE article_id = ? AND (created_at > ? OR (created_at = ? AND id >= ?)) ORDER BY created_at, id")
            .all(articleId, String(anchor.request_created_at), String(anchor.request_created_at), String(anchor.request_id)) as Row[];
        const requestIds = requests.map((row) => String(row.id));
        const messages = this.database.prepare(`SELECT id, response_kind, editorial_artifact_id, updated_at FROM assistant_messages
            WHERE article_id = ? AND (request_id IN (${requestIds.map(() => "?").join(",")}) OR (request_id IS NULL AND kind <> 'greeting' AND (created_at > ? OR (created_at = ? AND id >= ?))))
            ORDER BY created_at, id`).all(articleId, ...requestIds, String(anchor.created_at), String(anchor.created_at), String(anchor.id)) as Row[];
        const artifactIds = messages.flatMap((row) => typeof row.editorial_artifact_id === "string" ? [row.editorial_artifact_id] : []);

        return { requests, messages, artifactIds };
    }


    private createCheckpointPreview(messageId: string, anchor: Row, tail: ReturnType<AssistantRepository["getCheckpointTail"]>): AssistantCheckpointPreview {
        const current = this.database.prepare("SELECT current_revision_id FROM articles WHERE id = ?").get(String(anchor.article_id)) as Row | undefined;
        const draft = this.database.prepare("SELECT version, updated_at FROM article_drafts WHERE article_id = ?").get(String(anchor.article_id)) as Row | undefined;
        const tokenState = { requestIds: tail.requests.map((row) => [row.id, row.updated_at]), messageIds: tail.messages.map((row) => [row.id, row.updated_at]), currentRevisionId: current?.current_revision_id, draftVersion: draft?.version, draftUpdatedAt: draft?.updated_at };
        const tailToken = createHash("sha256").update(JSON.stringify(tokenState)).digest("base64url");
        const responseKinds = tail.messages.map((row) => String(row.response_kind ?? ""));
        const revisionId = anchor.base_revision_id === null ? undefined : String(anchor.base_revision_id);
        const revision = revisionId ? this.database.prepare("SELECT id, description, provenance_json, restored_from_revision_id, (SELECT COUNT(*) FROM article_revisions earlier WHERE earlier.article_id = r.article_id AND (earlier.created_at < r.created_at OR (earlier.created_at = r.created_at AND earlier.id <= r.id))) number FROM article_revisions r WHERE id = ? AND article_id = ?").get(revisionId, String(anchor.article_id)) as Row | undefined : undefined;
        const skillId = resolveBuiltInSkillId(String(anchor.explicit_skill_id ?? anchor.resolved_skill_id ?? ""));

        return {
            messageId,
            tailToken,
            counts: {
                messages: tail.messages.length,
                requests: tail.requests.length,
                proposals: responseKinds.filter((kind) => kind === "proposal_prepared" || kind === "proposal_and_findings_prepared").length,
                findings: responseKinds.filter((kind) => kind === "findings_prepared" || kind === "proposal_and_findings_prepared").length,
                translations: responseKinds.filter((kind) => kind === "translation_proposal_prepared").length,
                retries: tail.requests.filter((row) => row.retry_of_request_id !== null).length,
            },
            composer: {
                text: String(anchor.content ?? ""),
                ...(skillId ? { skillId } : {}),
                ...(anchor.skill_offset === null ? {} : { skillOffset: Number(anchor.skill_offset) }),
                ...(typeof anchor.target_language === "string" ? { targetLanguage: anchor.target_language } : {}),
                usedSelection: parseObject(anchor.scope_json).kind === "selection",
            },
            ...(revision ? { revision: { id: String(revision.id), number: Number(revision.number), ...(typeof revision.description === "string" && revision.description ? { description: revision.description } : {}), provenance: parseObject(revision.provenance_json), ...(typeof revision.restored_from_revision_id === "string" ? { restoredFromRevisionId: revision.restored_from_revision_id } : {}) } } : {}),
            draftDecisionRequired: Boolean(revision && draft),
        };
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

        const scope = JSON.parse(String(row.scope_json)) as AssistantRequestScope;
        const status = String(row.status) as AssistantRequestStatus;
        if (!requestStatuses.includes(status) || !scope || (scope.kind !== "article" && scope.kind !== "selection"))
            throw new Error("Invalid persisted assistant request.");

        const explicitSkillValue = row.explicit_skill_id === null ? undefined : String(row.explicit_skill_id);
        const resolvedSkillValue = row.resolved_skill_id === null ? undefined : String(row.resolved_skill_id);
        const skillSource = row.skill_source === null ? undefined : String(row.skill_source) as AssistantSkillSource;
        const explicitSkillId = explicitSkillValue && resolveBuiltInSkillId(explicitSkillValue);
        const resolvedSkillId = resolvedSkillValue && resolveBuiltInSkillId(resolvedSkillValue);
        if ((explicitSkillValue && !explicitSkillId) || (resolvedSkillValue && !resolvedSkillId) || (skillSource && !skillSources.includes(skillSource)))
            throw new Error("Invalid persisted assistant request.");

        const authorMessage = this.database.prepare("SELECT content, skill_offset FROM assistant_messages WHERE request_id = ? AND role = 'author' ORDER BY created_at, id LIMIT 1").get(requestId) as Row | undefined;
        if (!authorMessage || typeof authorMessage.content !== "string")
            throw new Error("Missing persisted assistant author message.");

        const capability = row.capability_name === null || row.capability_name === undefined ? undefined : String(row.capability_name);
        const executions = (this.database.prepare("SELECT capability_name, status, base_revision_id, started_at, completed_at FROM assistant_capability_executions WHERE request_id = ? ORDER BY id").all(requestId) as Row[])
            .map((execution): AssistantCapabilityExecution => ({
                capability: String(execution.capability_name),
                status: String(execution.status) as AssistantCapabilityExecution["status"],
                requestId,
                baseRevisionId: String(execution.base_revision_id),
                startedAt: String(execution.started_at),
                ...(execution.completed_at === null ? {} : { completedAt: String(execution.completed_at) }),
            }));

        return {
            id: String(row.id), articleId: String(row.article_id), baseRevisionId: String(row.base_revision_id), scope,
            ...(explicitSkillId ? { explicitSkillId } : {}), ...(resolvedSkillId ? { resolvedSkillId } : {}), ...(skillSource ? { skillSource } : {}), status,
            ...(row.retry_of_request_id === null ? {} : { retryOfRequestId: String(row.retry_of_request_id) }), ...(row.error_code === null ? {} : { errorCode: String(row.error_code) }),
            authorMessage: String(authorMessage.content),
            ...(authorMessage.skill_offset === null || authorMessage.skill_offset === undefined ? {} : { skillOffset: Number(authorMessage.skill_offset) }),
            ...(row.target_language === null || row.target_language === undefined ? {} : { targetLanguage: String(row.target_language) }),
            ...(capability ? { execution: { capability, status, requestId: String(row.id), baseRevisionId: String(row.base_revision_id) } } : {}),
            ...(executions.length ? { executions } : {}),
            createdAt: String(row.created_at), updatedAt: String(row.updated_at)
        };
    }


    private mapMessageFromRow(row: Row): AssistantMessage {
        const role = String(row.role) as AssistantMessageRole;
        const kind = String(row.kind) as AssistantMessageKind;
        const status = String(row.status) as AssistantMessageStatus;
        if (!roles.includes(role) || !kinds.includes(kind) || !statuses.includes(status))
            throw new Error("Invalid persisted assistant message.");

        const skillValue = row.skill_id === null ? undefined : String(row.skill_id);
        const skillId = skillValue === undefined ? undefined : resolveBuiltInSkillId(skillValue);
        if (skillValue !== undefined && !skillId)
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
        const artifactContent = this.parseArtifactContent(row.artifact_content);
        const proposalContent = row.proposal_content === null || row.proposal_content === undefined
            ? artifactContent?.proposal
            : String(row.proposal_content);

        return {
            id: String(row.id), articleId: String(row.article_id), ...(row.request_id === null ? {} : { requestId: String(row.request_id) }), role, kind, status,
            ...(row.content === null ? {} : { content: String(row.content) }), ...(kind === "greeting" ? { template: "greeting" as const } : {}), ...(status === "cancelled" ? { template: "request_cancelled" as const } : {}), ...(status === "failed" ? { template: "request_failed" as const } : {}), ...(skillId === undefined ? {} : { skillId }), ...(skillOffset === undefined ? {} : { skillOffset }),
            ...(selectionText ? { selectionText } : {}),
            ...(row.request_skill_source === "explicit" || row.request_skill_source === "inferred" ? { skillSource: row.request_skill_source } : {}),
            ...(row.response_kind === null ? {} : { responseKind: String(row.response_kind) as AssistantMessage["responseKind"] }),
            ...(row.editorial_artifact_id === null ? {} : { editorialArtifactId: String(row.editorial_artifact_id) }),
            ...(row.request_base_revision_id === null || row.request_base_revision_id === undefined ? {} : { baseRevisionId: String(row.request_base_revision_id) }),
            ...(row.request_revision_content === null || row.request_revision_content === undefined ? {} : { baseRevisionContent: String(row.request_revision_content) }),
            ...(proposalContent === undefined ? {} : { proposalContent }),
            ...(artifactContent?.translation ? { translation: artifactContent.translation } : {}),
            ...(artifactContent?.proposalSummaries ? { proposalSummaries: artifactContent.proposalSummaries } : {}),
            ...(artifactContent?.proposalSummaryLocale ? { proposalSummaryLocale: artifactContent.proposalSummaryLocale } : {}),
            createdAt: String(row.created_at), updatedAt: String(row.updated_at),
        };
    }


    private getProposalAcceptances(articleId: string): Map<string, ProposalAcceptance> {
        const rows = this.database.prepare("SELECT id, provenance_json FROM article_revisions WHERE article_id = ? ORDER BY created_at, id").all(articleId) as Row[];
        const acceptances = new Map<string, ProposalAcceptance>();
        for (const row of rows) {
            const provenance = parseObject(row.provenance_json);
            if (provenance.kind !== REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL || typeof provenance.editorialArtifactId !== "string")
                continue;

            const revisionId = String(row.id);
            if (provenance.wholeProposal === true) {
                acceptances.set(provenance.editorialArtifactId, { kind: "whole", revisionId });
                continue;
            }

            if (Array.isArray(provenance.acceptedChangeIds) && provenance.acceptedChangeIds.every((id) => typeof id === "string"))
                acceptances.set(provenance.editorialArtifactId, { kind: "changes", revisionId, acceptedChangeIds: provenance.acceptedChangeIds });
        }

        return acceptances;
    }


    private parseArtifactContent(value: unknown): { proposal?: string; translation?: NonNullable<AssistantMessage["translation"]>; proposalSummaries?: import("@skladno/shared").ProposalChangeSummary[]; proposalSummaryLocale?: string } | undefined {
        if (typeof value !== "string")
            return undefined;

        try {
            const parsed = JSON.parse(value) as { proposal?: unknown; translation?: { targetLanguage?: unknown; protectedSpans?: unknown; title?: unknown }; proposalSummaries?: unknown; proposalSummaryLocale?: unknown };
            const translation = typeof parsed.proposal === "string" && typeof parsed.translation?.targetLanguage === "string" && Array.isArray(parsed.translation.protectedSpans) && parsed.translation.protectedSpans.every((span) => typeof span === "string")
                ? { content: parsed.proposal, metadata: { targetLanguage: parsed.translation.targetLanguage, protectedSpans: parsed.translation.protectedSpans as string[], ...(typeof parsed.translation.title === "string" ? { title: parsed.translation.title } : {}) } }
                : undefined;

            return {
                ...(typeof parsed.proposal === "string" ? { proposal: parsed.proposal } : {}),
                ...(translation ? { translation } : {}),
                ...(Array.isArray(parsed.proposalSummaries) ? { proposalSummaries: parsed.proposalSummaries as import("@skladno/shared").ProposalChangeSummary[] } : {}),
                ...(typeof parsed.proposalSummaryLocale === "string" ? { proposalSummaryLocale: parsed.proposalSummaryLocale } : {}),
            };
        } catch {
            return undefined;
        }
    }
}
