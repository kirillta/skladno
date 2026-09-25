import type { AssistantAuthorizedAction, AssistantEditMode, EditorialOperation } from "@skladno/shared";

import type { EditorialEngine } from "../../editorial/engine/editorial-engine.js";
import type { ActionCapability } from "../capabilities/action-capability.js";
import type { AuthorSkillChange } from "../skills/author-skill-change.js";
import type { ReplayedAssistantRequest } from "./replayed-assistant-request.js";


export interface PreparedAssistantRequest extends ReplayedAssistantRequest {
    articleId: string;
    articleContent: string;
    articleTitle: string;
    editMode?: AssistantEditMode;
    editIntentAuthorized?: boolean;
    directEditAuthorized?: boolean;
    editCandidateAuthorized?: boolean;
    editDescription?: string;
    publishingCharacterLimit?: number;
    resolvedSkillId?: string;
    operation?: EditorialOperation;
    engine: EditorialEngine;
    usesCapabilityLoop: boolean;
    completedCapability?: string;
    capabilityActivities: { summary: string; status: "started" | "completed" }[];
    pendingActions: { capability: ActionCapability; input: Readonly<Record<string, string>> }[];
    pendingSkillChange?: AuthorSkillChange;
    authorizedActions: readonly AssistantAuthorizedAction[];
}
