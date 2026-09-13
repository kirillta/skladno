import type { ApplicationErrorCode } from "../cross-cutting/errors.js";
import { isBuiltInSkillId } from "./assistant-skills.js";
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
    | { type: typeof ASSISTANT_EVENT.SKILL_RESOLVED; requestId: string; skillId?: import("./assistant-skills.js").BuiltInSkillId; source?: AssistantSkillSource }
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
