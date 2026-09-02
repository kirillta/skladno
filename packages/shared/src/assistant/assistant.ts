export const BUILT_IN_SKILL = {
    TALKING_POINTS: "talking_points",
    NARRATIVE_DRAFT: "narrative_draft",
    FLOW_AND_CLARITY: "flow_and_clarity",
    FACT_CHECKING: "fact_checking",
    STYLE_REVIEW: "style_review",
    TRANSLATION: "translation",
} as const;


export type BuiltInSkillId = typeof BUILT_IN_SKILL[keyof typeof BUILT_IN_SKILL];


export const builtInSkills: readonly BuiltInSkillId[] = [
    BUILT_IN_SKILL.TALKING_POINTS,
    BUILT_IN_SKILL.NARRATIVE_DRAFT,
    BUILT_IN_SKILL.FLOW_AND_CLARITY,
    BUILT_IN_SKILL.FACT_CHECKING,
    BUILT_IN_SKILL.STYLE_REVIEW,
    BUILT_IN_SKILL.TRANSLATION,
];


export const builtInSkillScopeCompatibility: Record<BuiltInSkillId, readonly ("article" | "selection")[]> = {
    talking_points: ["article", "selection"],
    narrative_draft: ["article", "selection"],
    flow_and_clarity: ["article", "selection"],
    fact_checking: ["article", "selection"],
    style_review: ["article", "selection"],
    translation: ["article"],
};


export function isBuiltInSkillId(value: unknown): value is BuiltInSkillId {
    return typeof value === "string" && builtInSkills.includes(value as BuiltInSkillId);
}


/**
 * Compatibility only: maps pre-conversation editorial operation IDs to skills.
 * Do not persist or expose these IDs in new Assistant contracts.
 */
export const legacyEditorialOperationSkillMap = {
    thesis_to_narrative: BUILT_IN_SKILL.NARRATIVE_DRAFT,
    flow_revision: BUILT_IN_SKILL.FLOW_AND_CLARITY,
    fact_check: BUILT_IN_SKILL.FACT_CHECKING,
    style_review: BUILT_IN_SKILL.STYLE_REVIEW,
    translation: BUILT_IN_SKILL.TRANSLATION,
} as const;


export function resolveBuiltInSkillId(value: unknown): BuiltInSkillId | undefined {
    if (isBuiltInSkillId(value))
        return value;

    return typeof value === "string"
        ? legacyEditorialOperationSkillMap[value as keyof typeof legacyEditorialOperationSkillMap]
        : undefined;
}


export type AssistantRequestScope =
    | { kind: "article"; baseRevisionId: string }
    | { kind: "selection"; baseRevisionId: string; startOffset: number; endOffset: number };

export type AssistantMessageRole = "assistant" | "author" | "system";
export type AssistantMessageKind = "greeting" | "message" | "response" | "status";
/** Stable application-authored message templates; render these through the interface catalog. */
export type AssistantMessageTemplate = "greeting" | "request_cancelled" | "request_failed" | "profile_rebuilt";
export type AssistantMessageStatus = "completed" | "pending" | "failed" | "cancelled";
export type AssistantRequestStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AssistantSkillSource = "explicit" | "inferred";


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
    | "change_article_language"
    | "assign_publishing_profile"
    | "set_article_style_rules"
    | "add_revision_to_style_corpus"
    | "rebuild_style_profile";


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
    explicitSkillId?: BuiltInSkillId;
    resolvedSkillId?: BuiltInSkillId;
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


export interface AssistantMessage {
    id: string;
    articleId: string;
    requestId?: string;
    role: AssistantMessageRole;
    kind: AssistantMessageKind;
    status: AssistantMessageStatus;
    template?: AssistantMessageTemplate;
    content?: string;
    skillId?: BuiltInSkillId;
    skillSource?: AssistantSkillSource;
    skillOffset?: number;
    selectionText?: string;
    responseKind?: AssistantResponseKind;
    editorialArtifactId?: string;
    baseRevisionId?: string;
    baseRevisionContent?: string;
    proposalContent?: string;
    translation?: AssistantEditorialResult["translation"];
    proposalSummaries?: import("../articles/revision/revisions.js").ProposalChangeSummary[];
    proposalSummaryLocale?: string;
    createdAt: string;
    updatedAt: string;
}


export interface AssistantEditorialResult {
    metadataChanged?: boolean;
    proposal?: string;
    factCheck?: import("../editorial/editorial.js").FactCheck;
    styleReview?: import("../editorial/editorial.js").StyleReview;
    translation?: {
        metadata: import("../editorial/editorial.js").TranslationMetadata;
        content: string;
    };
}


export interface FactCheckClaimPreview {
    claim: string;
    checked: boolean;
}


export const ASSISTANT_EVENT = {
    ACCEPTED: "accepted",
    SKILL_RESOLVED: "skill_resolved",
    TEXT_DELTA: "text_delta",
    TOOL_STATUS: "tool_status",
    CAPABILITY_ACTIVITY: "capability_activity",
    STAGED_COMPLETION: "staged_completion",
    COMPLETED: "completed",
    ERROR: "error",
} as const;


export const assistantMessagesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/messages`;
export const assistantRequestsPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/requests`;


export interface NewAssistantRequest {
    kind: "new";
    requestId: string;
    authorMessage: string;
    scope: AssistantRequestScope;
    explicitSkillId?: BuiltInSkillId;
    skillOffset?: number;
    targetLanguage?: string;
}


export interface RetryAssistantRequest {
    kind: "retry";
    requestId: string;
    retryOfRequestId: string;
}


export type StartAssistantRequest = NewAssistantRequest | RetryAssistantRequest;


export type AssistantEvent =
    | { type: typeof ASSISTANT_EVENT.ACCEPTED; requestId: string }
    | { type: typeof ASSISTANT_EVENT.SKILL_RESOLVED; requestId: string; skillId?: BuiltInSkillId; source?: AssistantSkillSource }
    | { type: typeof ASSISTANT_EVENT.TEXT_DELTA; requestId: string; delta: string }
    | { type: typeof ASSISTANT_EVENT.TOOL_STATUS; requestId: string; tool: string; status: "started" | "completed"; claims?: FactCheckClaimPreview[] }
    | { type: typeof ASSISTANT_EVENT.CAPABILITY_ACTIVITY; requestId: string; activity: AssistantCapabilityActivity }
    | { type: typeof ASSISTANT_EVENT.STAGED_COMPLETION; requestId: string; completion: AssistantStagedCompletion }
    | { type: typeof ASSISTANT_EVENT.COMPLETED; requestId: string; responseKind: AssistantResponseKind; messageId: string; editorialArtifactId?: string; result?: AssistantEditorialResult }
    | { type: typeof ASSISTANT_EVENT.ERROR; requestId: string; errorCode: import("../cross-cutting/errors.js").ApplicationErrorCode; retryable: boolean };


const assistantResponseKinds: readonly AssistantResponseKind[] = [
    "editorial_conversation",
    "skill_response",
    "proposal_prepared",
    "findings_prepared",
    "proposal_and_findings_prepared",
    "translation_proposal_prepared",
    "request_cancelled",
    "request_failed",
];


function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function isAssistantResponseKind(value: unknown): value is AssistantResponseKind {
    return typeof value === "string" && assistantResponseKinds.some((kind) => kind === value);
}


export function isAssistantEvent(value: unknown): value is AssistantEvent {
    if (!isRecord(value) || typeof value.type !== "string" || typeof value.requestId !== "string")
        return false;

    if (value.type === ASSISTANT_EVENT.ACCEPTED)
        return true;

    if (value.type === ASSISTANT_EVENT.SKILL_RESOLVED)
        return (value.skillId === undefined || isBuiltInSkillId(value.skillId))
            && (value.source === undefined || value.source === "explicit" || value.source === "inferred");

    if (value.type === ASSISTANT_EVENT.TEXT_DELTA)
        return typeof value.delta === "string";

    if (value.type === ASSISTANT_EVENT.TOOL_STATUS)
        return typeof value.tool === "string" && (value.status === "started" || value.status === "completed");

    if (value.type === ASSISTANT_EVENT.CAPABILITY_ACTIVITY)
        return isRecord(value.activity) && typeof value.activity.summary === "string"
            && (value.activity.status === "started" || value.activity.status === "completed");

    if (value.type === ASSISTANT_EVENT.STAGED_COMPLETION)
        return isRecord(value.completion) && isAssistantResponseKind(value.completion.responseKind);

    if (value.type === ASSISTANT_EVENT.COMPLETED)
        return typeof value.messageId === "string" && isAssistantResponseKind(value.responseKind);

    return value.type === ASSISTANT_EVENT.ERROR && typeof value.errorCode === "string" && typeof value.retryable === "boolean";
}


export interface AssistantClient {
    streamAssistantRequest(articleId: string, input: StartAssistantRequest, onEvent: (event: AssistantEvent) => void, signal?: AbortSignal): Promise<void>;
}
