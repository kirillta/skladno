export { BUILT_IN_SKILL, builtInSkillScopeCompatibility, builtInSkills, editorialOperationSkillMap, isBuiltInSkillId } from "./assistant-skills.js";
export type { BuiltInSkillId } from "./assistant-skills.js";
import type { AssistantEvent } from "./assistant-events.js";
import type { Article } from "../articles/article/article.js";


export type AssistantRequestScope =
    | { kind: "article"; baseRevisionId: string }
    | { kind: "selection"; baseRevisionId: string; startOffset: number; endOffset: number };

export type AssistantMessageRole = "assistant" | "author" | "system";
export type AssistantMessageKind = "greeting" | "message" | "response" | "status";
/** Stable application-authored message templates; render these through the interface catalog. */
export type AssistantMessageTemplate = "greeting" | "request_cancelled" | "request_failed" | "profile_rebuilt" | "edit_applied";
export type AssistantMessageStatus = "completed" | "pending" | "failed" | "cancelled" | "rejected";
export type AssistantRequestStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AssistantSkillSource = "explicit" | "inferred";
export type AssistantEditMode = "review" | "direct";


export type AssistantEditCandidate =
    | { target: "article"; replacement: string }
    | { target: "selection"; original: string; replacement: string };


export interface AssistantAppliedEdit {
    revisionId: string;
}


/** A source-neutral Skill pointer. Skills guide requests; they grant no capability. */
export interface AssistantSkillReference {
    source: string;
    id: string;
    version: string;
}


/** Compact discovery data. Full Skill instructions stay outside transport contracts. */
export interface AssistantSkillSummary {
    reference: AssistantSkillReference;
    name: string;
    description: string;
}


/** Renderer-safe progress for a validated capability, never a tool name or input. */
export interface AssistantCapabilityActivity {
    summary: string;
    status: "started" | "completed";
}


export type AssistantAuthorizedAction = "rename_article"
    | "apply_article_edit"
    | "change_article_language"
    | "assign_publishing_profile"
    | "set_article_style_rules"
    | "add_revision_to_style_corpus"
    | "rebuild_style_profile"
    | "reject_translation"
    | "create_author_skill"
    | "update_author_skill"
    | "restore_author_skill"
    | "delete_author_skill";


/** Completion data held until the run is valid and its artifacts can be committed. */
export interface AssistantStagedCompletion {
    responseKind: AssistantResponseKind;
    result?: AssistantEditorialResult;
}


/** The only execution detail eligible for local Assistant-request persistence. */
export interface AssistantExecutionMetadata {
    capability: string;
    status: AssistantRequestStatus;
    requestId: string;
    baseRevisionId: string;
}


export interface AssistantCapabilityExecution {
    capability: string;
    status: "started" | "completed" | "failed" | "cancelled";
    requestId: string;
    baseRevisionId: string;
    startedAt: string;
    completedAt?: string;
}


export type AssistantResponseKind = "editorial_conversation"
    | "edit_applied"
    | "skill_response"
    | "proposal_prepared"
    | "findings_prepared"
    | "proposal_and_findings_prepared"
    | "translation_proposal_prepared"
    | "request_cancelled"
    | "request_failed";


export interface AssistantRequest {
    id: string;
    articleId: string;
    baseRevisionId: string;
    scope: AssistantRequestScope;
    explicitSkillId?: string;
    resolvedSkillId?: string;
    skillSource?: AssistantSkillSource;
    status: AssistantRequestStatus;
    retryOfRequestId?: string;
    authorMessage: string;
    skillOffset?: number;
    targetLanguage?: string;
    errorCode?: string;
    errorParameters?: Record<string, unknown>;
    execution?: AssistantExecutionMetadata;
    executions?: AssistantCapabilityExecution[];
    createdAt: string;
    updatedAt: string;
}


export type ProposalAcceptance =
    | { kind: "whole"; revisionId: string }
    | { kind: "changes"; revisionId: string; acceptedChangeIds: string[] };


export interface AssistantMessage {
    id: string;
    articleId: string;
    requestId?: string;
    role: AssistantMessageRole;
    kind: AssistantMessageKind;
    status: AssistantMessageStatus;
    template?: AssistantMessageTemplate;
    content?: string;
    skillId?: string;
    skillSource?: AssistantSkillSource;
    skillOffset?: number;
    selectionText?: string;
    responseKind?: AssistantResponseKind;
    editorialArtifactId?: string;
    baseRevisionId?: string;
    baseRevisionContent?: string;
    proposalContent?: string;
    proposalAcceptance?: ProposalAcceptance;
    editCandidate?: AssistantEditCandidate;
    appliedEdit?: AssistantAppliedEdit;
    translation?: AssistantEditorialResult["translation"];
    proposalSummaries?: import("../articles/revision/revisions.js").ProposalChangeSummary[];
    proposalSummaryLocale?: string;
    createdAt: string;
    updatedAt: string;
}


export interface AssistantEditorialResult {
    metadataChanged?: boolean;
    articleChanged?: boolean;
    proposal?: string;
    factCheck?: import("../editorial/editorial.js").FactCheck;
    styleReview?: import("../editorial/editorial.js").StyleReview;
    translation?: {
        metadata: import("../editorial/editorial.js").TranslationMetadata;
        content: string;
    };
}


export const createAssistantMessagesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/messages`;
export const createAssistantRequestsPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/requests`;
export const assistantSkillsPath = "/api/assistant/skills";
export const createAssistantTranslationRejectionPath = (articleId: string, editorialArtifactId: string) => `${createAssistantMessagesPath(articleId)}/${encodeURIComponent(editorialArtifactId)}/translation-rejection`;
export const createAssistantCheckpointPreviewPath = (articleId: string, messageId: string) => `${createAssistantMessagesPath(articleId)}/${encodeURIComponent(messageId)}/checkpoint`;
export const createAssistantCheckpointRestorePath = (articleId: string, messageId: string) => `${createAssistantCheckpointPreviewPath(articleId, messageId)}/restore`;
export const createAssistantEditModePath = (articleId: string) => `${createAssistantMessagesPath(articleId)}/edit-mode`;
export const createAssistantApplyEditPath = (articleId: string, messageId: string) => `${createAssistantMessagesPath(articleId)}/${encodeURIComponent(messageId)}/apply-edit`;


export interface AssistantCheckpointCounts {
    messages: number;
    requests: number;
    proposals: number;
    findings: number;
    translations: number;
    retries: number;
}


export interface AssistantCheckpointComposer {
    text: string;
    skillId?: string;
    skillOffset?: number;
    targetLanguage?: string;
    usedSelection: boolean;
}


export interface AssistantCheckpointPreview {
    messageId: string;
    tailToken: string;
    counts: AssistantCheckpointCounts;
    composer: AssistantCheckpointComposer;
    revision?: { id: string; number: number; description?: string; provenance: Record<string, unknown>; restoredFromRevisionId?: string };
    draftDecisionRequired: boolean;
}


export type AssistantCheckpointDraftMode = "preserve" | "discard";


export interface RestoreAssistantCheckpointInput {
    tailToken: string;
    draftMode?: AssistantCheckpointDraftMode;
}


export interface RestoreAssistantCheckpointResult {
    messages: AssistantMessage[];
    article: Article;
    composer: AssistantCheckpointComposer;
}


export interface NewAssistantRequest {
    kind: "new";
    requestId: string;
    authorMessage: string;
    scope: AssistantRequestScope;
    explicitSkillId?: string;
    skillOffset?: number;
    targetLanguage?: string;
    interfaceLocale?: string;
}


export interface RetryAssistantRequest {
    kind: "retry";
    requestId: string;
    retryOfRequestId: string;
    interfaceLocale?: string;
}


export type StartAssistantRequest = NewAssistantRequest | RetryAssistantRequest;


export { ASSISTANT_EVENT, isAssistantEvent } from "./assistant-events.js";
export type { AssistantEvent, FactCheckClaimPreview } from "./assistant-events.js";


export interface AssistantClient {
    getAssistantEditMode(articleId: string): Promise<AssistantEditMode>;
    setAssistantEditMode(articleId: string, mode: AssistantEditMode): Promise<AssistantEditMode>;
    applyAssistantEdit(articleId: string, messageId: string): Promise<import("../articles/revision/revision.js").ArticleRevision>;
    listAssistantSkills(): Promise<AssistantSkillSummary[]>;
    streamAssistantRequest(articleId: string, input: StartAssistantRequest, onEvent: (event: AssistantEvent) => void, signal?: AbortSignal): Promise<void>;
    rejectTranslation(articleId: string, editorialArtifactId: string): Promise<void>;
    previewAssistantCheckpoint(articleId: string, messageId: string): Promise<AssistantCheckpointPreview>;
    restoreAssistantCheckpoint(articleId: string, messageId: string, input: RestoreAssistantCheckpointInput): Promise<RestoreAssistantCheckpointResult>;
}
