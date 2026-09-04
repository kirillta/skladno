export const editorialPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/editorial`;
export const factChecksPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/fact-checks`;
export const factCheckResolutionPath = (articleId: string, occurrenceId: string) => `${factChecksPath(articleId)}/${encodeURIComponent(occurrenceId)}/resolution`;


export const EDITORIAL_OPERATION = {
    THESIS_TO_NARRATIVE: "thesis_to_narrative",
    FLOW_REVISION: "flow_revision",
    FACT_CHECK: "fact_check",
    STYLE_REVIEW: "style_review",
    TRANSLATION: "translation",
} as const;


export type EditorialOperation = typeof EDITORIAL_OPERATION[keyof typeof EDITORIAL_OPERATION];


export interface StartEditorialRequest {
    requestId: string;
    operation: EditorialOperation;
    authorContext?: string;
    targetLanguage?: string;
}


export interface EditorialSession {
    articleId: string;
    previousResponseId?: string;
    updatedAt: string;
}


export interface EditorialTextDeltaEvent {
    type: "text_delta";
    requestId: string;
    delta: string;
}


export interface EditorialToolStatusEvent {
    type: "tool_status";
    requestId: string;
    tool: string;
    status: "started" | "completed";
}


export interface EditorialCompletedEvent {
    type: "completed";
    requestId: string;
    responseId: string;
    text: string;
    styleReview?: StyleReview;
    factCheck?: FactCheck;
    translation?: TranslationMetadata;
    editorialArtifactId?: string;
}


export interface TranslationMetadata {
    targetLanguage: string;
    protectedSpans: string[];
    /** Present for completed title-and-body translations; omitted by legacy saved proposals. */
    title?: string;
}


export interface StyleFinding {
    divergence: string;
    suggestion: string;
    traitIds: string[];
}


export interface StyleReview {
    findings: StyleFinding[];
    profileVersion?: import("../style/style.js").StyleProfile["version"];
    confidence?: import("../style/style.js").StyleProfile["confidence"];
    traitLabels?: Record<string, string>;
    globalRules?: string[];
    articleRules?: string[];
}


export const FACT_CHECK_STATUS = {
    SUPPORTED: "supported",
    DISPUTED: "disputed",
    UNVERIFIABLE: "unverifiable",
} as const;


export interface FactCheckSource {
    url: string;
    title: string;
    excerpt?: string;
    quality: "primary" | "credible" | "secondary" | "unknown";
    publishedAt?: string;
}


export interface FactCheckFinding {
    /** Stable across unchanged claim appearances; assigned locally after a completed run. */
    factId?: string;
    occurrenceId?: string;
    claim: string;
    status: typeof FACT_CHECK_STATUS[keyof typeof FACT_CHECK_STATUS];
    rationale: string;
    uncertainty: string;
    sources: FactCheckSource[];
    importance?: "high" | "normal" | "low";
    reusedFromRevisionId?: string;
    checkedAt?: string;
    resolution?: "corrected_or_removed" | "accepted_as_written" | "evidence_accepted";
    stale?: boolean;
}


export interface FactCheck {
    reviewedRevisionId?: string;
    createdAt?: string;
    findings: FactCheckFinding[];
}


export interface FactCheckClient {
    listFactChecks?(articleId: string): Promise<FactCheck[]>;
    resolveFactCheckFinding?(articleId: string, findingId: string, resolution: NonNullable<FactCheckFinding["resolution"]>): Promise<void>;
}


export const EDITORIAL_ERROR_CATEGORY = {
    CONFIGURATION: "configuration",
    NETWORK: "network",
    PROVIDER: "provider",
    MALFORMED_STREAM: "malformed_stream",
    INVALID_OUTPUT: "invalid_output",
    SESSION_EXPIRED: "session_expired",
    CANCELLED: "cancelled",
} as const;


export interface EditorialErrorEvent {
    type: "error";
    requestId: string;
    code: typeof EDITORIAL_ERROR_CATEGORY[keyof typeof EDITORIAL_ERROR_CATEGORY];
    errorCode: import("../cross-cutting/errors.js").ApplicationErrorCode;
    parameters?: Record<string, string | number>;
    retryable: boolean;
}


export type EditorialEvent =
    | EditorialTextDeltaEvent
    | EditorialToolStatusEvent
    | EditorialCompletedEvent
    | EditorialErrorEvent;


/** A proposal-only stream. Consumers must explicitly accept text through a separate revision operation. */
export interface EditorialClient {
    streamEditorial(
        articleId: string,
        input: StartEditorialRequest,
        onEvent: (event: EditorialEvent) => void,
        signal?: AbortSignal,
    ): Promise<void>;
}
