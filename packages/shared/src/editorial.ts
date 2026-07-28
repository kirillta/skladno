export const editorialPath = (documentId: string) => `/api/documents/${encodeURIComponent(documentId)}/editorial`;


export const EDITORIAL_OPERATION = {
    THESIS_TO_NARRATIVE: "thesis_to_narrative",
    FLOW_REVISION: "flow_revision",
    STYLE_REVIEW: "style_review",
} as const;


export type EditorialOperation = typeof EDITORIAL_OPERATION[keyof typeof EDITORIAL_OPERATION];


export interface StartEditorialRequest {
    requestId: string;
    operation: EditorialOperation;
    authorContext?: string;
}


export interface EditorialSession {
    documentId: string;
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
}


export interface StyleFinding {
    divergence: string;
    suggestion: string;
    traitIds: string[];
}


export interface StyleReview {
    findings: StyleFinding[];
}


export interface EditorialErrorEvent {
    type: "error";
    requestId: string;
    code: "configuration" | "network" | "provider" | "malformed_stream" | "cancelled";
    message: string;
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
        documentId: string,
        input: StartEditorialRequest,
        onEvent: (event: EditorialEvent) => void,
        signal?: AbortSignal,
    ): Promise<void>;
}
