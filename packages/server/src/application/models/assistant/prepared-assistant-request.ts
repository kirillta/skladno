import type { AssistantAuthorizedAction, BuiltInSkillId, EditorialOperation } from "@skladno/shared";

import type { EditorialEngine } from "../../ports/editorial-engine.js";
import type { ActionCapability } from "./action-capability.js";
import type { ReplayedAssistantRequest } from "./replayed-assistant-request.js";


export interface PreparedAssistantRequest extends ReplayedAssistantRequest {
    articleId: string;
    articleContent: string;
    articleTitle: string;
    publishingCharacterLimit?: number;
    resolvedSkillId?: BuiltInSkillId;
    operation: EditorialOperation;
    engine: EditorialEngine;
    usesCapabilityLoop: boolean;
    completedCapability?: string;
    capabilityActivities: { summary: string; status: "started" | "completed" }[];
    pendingActions: { capability: ActionCapability; input: Readonly<Record<string, string>> }[];
    authorizedActions: readonly AssistantAuthorizedAction[];
}
