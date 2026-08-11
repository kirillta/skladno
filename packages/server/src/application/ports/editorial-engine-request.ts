import type { BuiltInSkillId, EditorialOperation, StyleProfile } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    articleSelection?: boolean;
    skillId?: BuiltInSkillId;
    surroundingArticleCharacterCount?: number;
    styleProfile?: StyleProfile;
    targetArticleCharacterLimit?: number;
    previousResponseId?: string;
    targetLanguage?: string;
}
