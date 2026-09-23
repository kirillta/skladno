import type { ApplicationErrorCode } from "../cross-cutting/errors.js";
import type { AssistantEditorialResult, AssistantResponseKind, AssistantSkillSource, AssistantStagedCompletion } from "./assistant.js";


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

export type AssistantEvent =
    | { type: typeof ASSISTANT_EVENT.ACCEPTED; requestId: string }
    | { type: typeof ASSISTANT_EVENT.SKILL_RESOLVED; requestId: string; skillId?: string; source?: AssistantSkillSource }
    | { type: typeof ASSISTANT_EVENT.TEXT_DELTA; requestId: string; delta: string }
    | { type: typeof ASSISTANT_EVENT.TOOL_STATUS; requestId: string; tool: string; status: "started" | "completed"; claims?: FactCheckClaimPreview[] }
    | { type: typeof ASSISTANT_EVENT.CAPABILITY_ACTIVITY; requestId: string; activity: import("./assistant.js").AssistantCapabilityActivity }
    | { type: typeof ASSISTANT_EVENT.STAGED_COMPLETION; requestId: string; completion: AssistantStagedCompletion }
    | { type: typeof ASSISTANT_EVENT.COMPLETED; requestId: string; responseKind: AssistantResponseKind; messageId: string; editorialArtifactId?: string; result?: AssistantEditorialResult }
    | { type: typeof ASSISTANT_EVENT.ERROR; requestId: string; errorCode: ApplicationErrorCode; retryable: boolean };

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


function isSkillResolution(value: Record<string, unknown>): boolean {
    return (value.skillId === undefined || typeof value.skillId === "string")
        && (value.source === undefined || value.source === "explicit" || value.source === "inferred");
}


function isCapabilityActivity(value: unknown): boolean {
    if (!isRecord(value))
        return false;

    return typeof value.summary === "string" && (value.status === "started" || value.status === "completed");
}


export function isAssistantEvent(value: unknown): value is AssistantEvent {
    if (!isRecord(value) || typeof value.type !== "string" || typeof value.requestId !== "string")
        return false;

    switch (value.type) {
        case ASSISTANT_EVENT.ACCEPTED:
            return true;
        case ASSISTANT_EVENT.SKILL_RESOLVED:
            return isSkillResolution(value);
        case ASSISTANT_EVENT.TEXT_DELTA:
            return typeof value.delta === "string";
        case ASSISTANT_EVENT.TOOL_STATUS:
            return typeof value.tool === "string" && (value.status === "started" || value.status === "completed");
        case ASSISTANT_EVENT.CAPABILITY_ACTIVITY:
            return isCapabilityActivity(value.activity);
        case ASSISTANT_EVENT.STAGED_COMPLETION:
            return isRecord(value.completion) && isAssistantResponseKind(value.completion.responseKind);
        case ASSISTANT_EVENT.COMPLETED:
            return typeof value.messageId === "string" && isAssistantResponseKind(value.responseKind);
        case ASSISTANT_EVENT.ERROR:
            return typeof value.errorCode === "string" && typeof value.retryable === "boolean";
        default:
            return false;
    }
}
