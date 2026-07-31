export const editorialPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/editorial`;


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
}


export interface TranslationMetadata {
    targetLanguage: string;
    protectedSpans: string[];
}


export interface StyleFinding {
    divergence: string;
    suggestion: string;
    traitIds: string[];
}


export interface StyleReview {
    findings: StyleFinding[];
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
    claim: string;
    status: typeof FACT_CHECK_STATUS[keyof typeof FACT_CHECK_STATUS];
    rationale: string;
    uncertainty: string;
    sources: FactCheckSource[];
}


export interface FactCheck {
    findings: FactCheckFinding[];
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
    errorCode: import("./errors.js").ApplicationErrorCode;
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
