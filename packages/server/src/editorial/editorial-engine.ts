import type { EditorialOperation, FactCheck, StyleProfile, StyleReview } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    styleProfile?: StyleProfile;
    previousResponseId?: string;
}


export const EDITORIAL_ENGINE_EVENT = {
    TEXT_DELTA: "text_delta",
    TOOL_STATUS: "tool_status",
    COMPLETED: "completed",
} as const;


export type EditorialEngineEvent =
    | { type: typeof EDITORIAL_ENGINE_EVENT.TEXT_DELTA; delta: string }
    | { type: typeof EDITORIAL_ENGINE_EVENT.TOOL_STATUS; tool: string; status: "started" | "completed" }
    | { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED; responseId: string; text: string; styleReview?: StyleReview; factCheck?: FactCheck };


export type EditorialEngineErrorCode = "provider" | "network" | "invalid_output" | "incomplete_stream" | "session_expired";


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
}
