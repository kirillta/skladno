import { ASSISTANT_EVENT, type AssistantEvent } from "@skladno/shared";

import { getActivityForEditorialOperation } from "../capabilities/editorial-capability-catalog.js";
import type { PreparedAssistantRequest } from "./prepared-assistant-request.js";


export function getAssistantInitialEvents(request: PreparedAssistantRequest): AssistantEvent[] {
    return [
        { type: ASSISTANT_EVENT.ACCEPTED, requestId: request.requestId },
        {
            type: ASSISTANT_EVENT.SKILL_RESOLVED,
            requestId: request.requestId,
            ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {}),
        },
        ...(!request.usesCapabilityLoop && request.operation
            ? [{ type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: getActivityForEditorialOperation(request.operation), status: "started" as const } }]
            : []),
    ];
}
