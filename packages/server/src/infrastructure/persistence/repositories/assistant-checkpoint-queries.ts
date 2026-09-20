import { createHash } from "node:crypto";
import { resolveBuiltInSkillId, type AssistantCheckpointPreview } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { parseObject, type Row } from "./repository-utils.js";


export function getCheckpointAnchor(database: SqliteDatabase, articleId: string, messageId: string): Row | undefined {
    return database.prepare(`SELECT m.*, r.id request_id, r.created_at request_created_at, r.base_revision_id, r.scope_json, r.explicit_skill_id, r.resolved_skill_id, r.target_language
        FROM assistant_messages m JOIN assistant_requests r ON r.id = m.request_id
        WHERE m.id = ? AND m.article_id = ? AND m.role = 'author' AND m.kind = 'message'`).get(messageId, articleId) as Row | undefined;
}


export function getCheckpointTail(database: SqliteDatabase, articleId: string, anchor: Row) {
    const requests = database.prepare("SELECT id, retry_of_request_id, updated_at FROM assistant_requests WHERE article_id = ? AND (created_at > ? OR (created_at = ? AND id >= ?)) ORDER BY created_at, id")
        .all(articleId, String(anchor.request_created_at), String(anchor.request_created_at), String(anchor.request_id)) as Row[];
    const requestIds = requests.map((row) => String(row.id));
    const messages = database.prepare(`SELECT id, response_kind, editorial_artifact_id, updated_at FROM assistant_messages
        WHERE article_id = ? AND (request_id IN (${requestIds.map(() => "?").join(",")}) OR (request_id IS NULL AND kind <> 'greeting' AND (created_at > ? OR (created_at = ? AND id >= ?))))
        ORDER BY created_at, id`).all(articleId, ...requestIds, String(anchor.created_at), String(anchor.created_at), String(anchor.id)) as Row[];
    const artifactIds = messages.flatMap((row) => typeof row.editorial_artifact_id === "string" ? [row.editorial_artifact_id] : []);

    return { requests, messages, artifactIds };
}


export function createCheckpointPreview(database: SqliteDatabase, messageId: string, anchor: Row, tail: ReturnType<typeof getCheckpointTail>): AssistantCheckpointPreview {
    const current = database.prepare("SELECT current_revision_id FROM articles WHERE id = ?").get(String(anchor.article_id)) as Row | undefined;
    const draft = database.prepare("SELECT version, updated_at FROM article_drafts WHERE article_id = ?").get(String(anchor.article_id)) as Row | undefined;
    const tokenState = { requestIds: tail.requests.map((row) => [row.id, row.updated_at]), messageIds: tail.messages.map((row) => [row.id, row.updated_at]), currentRevisionId: current?.current_revision_id, draftVersion: draft?.version, draftUpdatedAt: draft?.updated_at };
    const tailToken = createHash("sha256").update(JSON.stringify(tokenState)).digest("base64url");
    const responseKinds = tail.messages.map((row) => String(row.response_kind ?? ""));
    const revisionId = anchor.base_revision_id === null ? undefined : String(anchor.base_revision_id);
    const revision = revisionId ? database.prepare("SELECT id, description, provenance_json, restored_from_revision_id, (SELECT COUNT(*) FROM article_revisions earlier WHERE earlier.article_id = r.article_id AND (earlier.created_at < r.created_at OR (earlier.created_at = r.created_at AND earlier.id <= r.id))) number FROM article_revisions r WHERE id = ? AND article_id = ?").get(revisionId, String(anchor.article_id)) as Row | undefined : undefined;
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
