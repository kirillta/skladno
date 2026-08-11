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
    narrative_draft: ["article"],
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
export type AssistantMessageTemplate = "greeting" | "request_cancelled" | "request_failed";
export type AssistantMessageStatus = "completed" | "pending" | "failed" | "cancelled";
export type AssistantRequestStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AssistantSkillSource = "explicit" | "inferred";
export type AssistantResponseKind = "editorial_conversation" |
    "skill_response" |
    "proposal_prepared" |
    "findings_prepared" |
    "proposal_and_findings_prepared" |
    "translation_proposal_prepared" |
    "request_cancelled" |
    "request_failed";

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
    errorCode?: string;
    errorParameters?: Record<string, unknown>;
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
    skillOffset?: number;
    selectionText?: string;
    responseKind?: AssistantResponseKind;
    editorialArtifactId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AssistantEditorialResult {
    proposal?: string;
    factCheck?: import("../editorial/editorial.js").FactCheck;
    styleReview?: import("../editorial/editorial.js").StyleReview;
    translation?: {
        metadata: import("../editorial/editorial.js").TranslationMetadata;
        content: string;
    };
}


export const assistantMessagesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/messages`;
export const assistantRequestsPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/assistant/requests`;

export interface StartAssistantRequest {
    requestId: string;
    authorMessage: string;
    scope: AssistantRequestScope;
    explicitSkillId?: BuiltInSkillId;
    skillOffset?: number;
    targetLanguage?: string;
    retryOfRequestId?: string;
}

export type AssistantEvent =
    | { type: "accepted"; requestId: string }
    | { type: "skill_resolved"; requestId: string; skillId?: BuiltInSkillId; source?: AssistantSkillSource }
    | { type: "text_delta"; requestId: string; delta: string }
    | { type: "tool_status"; requestId: string; tool: string; status: "started" | "completed" }
    | { type: "completed"; requestId: string; responseKind: AssistantResponseKind; messageId: string; editorialArtifactId?: string; result?: AssistantEditorialResult }
    | { type: "error"; requestId: string; errorCode: import("../cross-cutting/errors.js").ApplicationErrorCode; retryable: boolean };

export interface AssistantClient {
    streamAssistantRequest(articleId: string, input: StartAssistantRequest, onEvent: (event: AssistantEvent) => void, signal?: AbortSignal): Promise<void>;
}
