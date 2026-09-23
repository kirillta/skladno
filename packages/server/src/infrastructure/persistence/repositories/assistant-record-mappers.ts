import { REVISION_PROVENANCE_KIND, type AssistantMessage, type AssistantMessageKind, type AssistantMessageRole, type AssistantMessageStatus, type AssistantRequestScope, type ProposalAcceptance, type ProposalChangeSummary } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { parseObject, type Row } from "./repository-utils.js";

const roles: readonly AssistantMessageRole[] = ["assistant", "author", "system"];
const kinds: readonly AssistantMessageKind[] = ["greeting", "message", "response", "status"];
const statuses: readonly AssistantMessageStatus[] = ["completed", "pending", "failed", "cancelled", "rejected"];


function getSelectionRequestFields(row: Row, role: AssistantMessageRole, requestScope: AssistantRequestScope | undefined): Partial<AssistantMessage> {
    if (role !== "author" || requestScope?.kind !== "selection" || typeof row.request_revision_content !== "string")
        return {};

    return { selectionText: String(row.request_revision_content).slice(requestScope.startOffset, requestScope.endOffset) };
}


function getAssistantIdentityFields(row: Row, role: AssistantMessageRole, kind: AssistantMessageKind, status: AssistantMessageStatus, skillId: string | undefined, skillOffset: number | undefined): Pick<AssistantMessage, "id" | "articleId" | "role" | "kind" | "status"> & Partial<AssistantMessage> {
    return {
        id: String(row.id),
        articleId: String(row.article_id),
        ...(row.request_id === null ? {} : { requestId: String(row.request_id) }),
        role,
        kind,
        status,
        ...(row.content === null ? {} : { content: String(row.content) }),
        ...(kind === "greeting" ? { template: "greeting" as const } : {}),
        ...(status === "cancelled" ? { template: "request_cancelled" as const } : {}),
        ...(status === "failed" ? { template: "request_failed" as const } : {}),
        ...(skillId === undefined ? {} : { skillId }),
        ...(skillOffset === undefined ? {} : { skillOffset }),
    };
}


function getAssistantRequestFields(row: Row): Partial<AssistantMessage> {
    return {
        ...(row.request_skill_source === "explicit" || row.request_skill_source === "inferred" ? { skillSource: row.request_skill_source } : {}),
        ...(row.response_kind === null ? {} : { responseKind: String(row.response_kind) as AssistantMessage["responseKind"] }),
        ...(row.request_base_revision_id === null || row.request_base_revision_id === undefined ? {} : { baseRevisionId: String(row.request_base_revision_id) }),
        ...(row.request_revision_content === null || row.request_revision_content === undefined ? {} : { baseRevisionContent: String(row.request_revision_content) }),
    };
}


function getAssistantArtifactFields(row: Row, artifactContent: ReturnType<typeof parseAssistantArtifactContent>, proposalContent: string | undefined): Partial<AssistantMessage> {
    return {
        ...(proposalContent === undefined ? {} : { proposalContent }),
        ...(artifactContent?.translation ? { translation: artifactContent.translation } : {}),
        ...(artifactContent?.proposalSummaries ? { proposalSummaries: artifactContent.proposalSummaries } : {}),
        ...(artifactContent?.proposalSummaryLocale ? { proposalSummaryLocale: artifactContent.proposalSummaryLocale } : {}),
        ...(row.editorial_artifact_id === null ? {} : { editorialArtifactId: String(row.editorial_artifact_id) }),
    };
}


export function mapAssistantMessageFromRow(row: Row): AssistantMessage {
    const { role, kind, status, skillId, skillOffset, requestScope } = readAssistantMessageRowContext(row);
    const artifactContent = parseAssistantArtifactContent(row.artifact_content);
    const proposalContent = row.proposal_content === null || row.proposal_content === undefined
        ? artifactContent?.proposal
        : String(row.proposal_content);

    return {
        ...getAssistantIdentityFields(row, role, kind, status, skillId, skillOffset),
        ...getSelectionRequestFields(row, role, requestScope),
        ...getAssistantRequestFields(row),
        ...getAssistantArtifactFields(row, artifactContent, proposalContent),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
}


function readAssistantMessageRowContext(row: Row) {
    const role = String(row.role) as AssistantMessageRole;
    const kind = String(row.kind) as AssistantMessageKind;
    const status = String(row.status) as AssistantMessageStatus;
    if (!roles.includes(role) || !kinds.includes(kind) || !statuses.includes(status))
        throw new Error("Invalid persisted assistant message.");

    const skillValue = row.skill_id === null ? undefined : String(row.skill_id);
    const skillId = skillValue;
    if (skillValue !== undefined && !skillId)
        throw new Error("Invalid persisted assistant skill.");

    const skillOffset = row.skill_offset === null || row.skill_offset === undefined ? undefined : Number(row.skill_offset);
    if (skillOffset !== undefined && (!Number.isInteger(skillOffset) || skillOffset < 0))
        throw new Error("Invalid persisted assistant skill offset.");

    const requestScope = row.request_scope_json === null || row.request_scope_json === undefined
        ? undefined
        : JSON.parse(String(row.request_scope_json)) as AssistantRequestScope;
    return { role, kind, status, skillId, skillOffset, requestScope };
}


export function getProposalAcceptances(database: SqliteDatabase, articleId: string): Map<string, ProposalAcceptance> {
    const rows = database.prepare("SELECT id, provenance_json FROM article_revisions WHERE article_id = ? ORDER BY created_at, id").all(articleId) as Row[];
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


function parseTranslation(proposal: unknown, translation: { targetLanguage?: unknown; protectedSpans?: unknown; title?: unknown } | undefined): AssistantMessage["translation"] | undefined {
    if (typeof proposal !== "string" || typeof translation?.targetLanguage !== "string" || !Array.isArray(translation.protectedSpans)
        || !translation.protectedSpans.every((span) => typeof span === "string"))
        return undefined;

    return {
        content: proposal,
        metadata: {
            targetLanguage: translation.targetLanguage,
            protectedSpans: translation.protectedSpans as string[],
            ...(typeof translation.title === "string" ? { title: translation.title } : {}),
        },
    };
}


function parseAssistantArtifactContent(value: unknown): { proposal?: string; translation?: NonNullable<AssistantMessage["translation"]>; proposalSummaries?: ProposalChangeSummary[]; proposalSummaryLocale?: string } | undefined {
    if (typeof value !== "string")
        return undefined;

    try {
        const parsed = JSON.parse(value) as { proposal?: unknown; translation?: { targetLanguage?: unknown; protectedSpans?: unknown; title?: unknown }; proposalSummaries?: unknown; proposalSummaryLocale?: unknown };
        const translation = parseTranslation(parsed.proposal, parsed.translation);

        return {
            ...(typeof parsed.proposal === "string" ? { proposal: parsed.proposal } : {}),
            ...(translation ? { translation } : {}),
            ...(Array.isArray(parsed.proposalSummaries) ? { proposalSummaries: parsed.proposalSummaries as ProposalChangeSummary[] } : {}),
            ...(typeof parsed.proposalSummaryLocale === "string" ? { proposalSummaryLocale: parsed.proposalSummaryLocale } : {}),
        };
    } catch {
        return undefined;
    }
}
