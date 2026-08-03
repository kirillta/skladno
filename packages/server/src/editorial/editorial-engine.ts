import type { EditorialOperation, FactCheck, StyleProfile, StyleReview, TranslationMetadata } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    styleProfile?: StyleProfile;
    previousResponseId?: string;
    targetLanguage?: string;
}


export const EDITORIAL_ENGINE_EVENT = {
    TEXT_DELTA: "text_delta",
    TOOL_STATUS: "tool_status",
    COMPLETED: "completed",
} as const;


export type EditorialEngineEvent =
    | { type: typeof EDITORIAL_ENGINE_EVENT.TEXT_DELTA; delta: string }
    | { type: typeof EDITORIAL_ENGINE_EVENT.TOOL_STATUS; tool: string; status: "started" | "completed" }
    | { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED; responseId: string; text: string; styleReview?: StyleReview; factCheck?: FactCheck; translation?: TranslationMetadata };


export const EDITORIAL_ENGINE_ERROR = {
    PROVIDER: "provider",
    NETWORK: "network",
    INVALID_OUTPUT: "invalid_output",
    INCOMPLETE_STREAM: "incomplete_stream",
    SESSION_EXPIRED: "session_expired",
} as const;

export type EditorialEngineErrorCode = typeof EDITORIAL_ENGINE_ERROR[keyof typeof EDITORIAL_ENGINE_ERROR];


export class EditorialEngineError extends Error {
    constructor(
        readonly code: EditorialEngineErrorCode,
        message: string,
    ) {
        super(message);
    }
}


export interface EditorialEngine {
    stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent>;
    streamConversation?(request: { message: string; article: string; scope: "article" | "selection"; history: { role: "author" | "assistant"; content: string }[]; signal: AbortSignal }): AsyncIterable<EditorialEngineEvent>;
}
