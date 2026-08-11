import type { BuiltInSkillId, EditorialOperation, StyleProfile } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    skillId?: BuiltInSkillId;
    styleProfile?: StyleProfile;
    previousResponseId?: string;
    targetLanguage?: string;
}
