import type { BuiltInSkillId, EditorialOperation, FactCheckFinding, StyleProfile } from "@skladno/shared";


export interface EditorialEngineRequest {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    articleSelection?: boolean;
    skillId?: BuiltInSkillId;
    surroundingArticleCharacterCount?: number;
    styleProfile?: StyleProfile;
    articleStyleRules?: string;
    targetArticleCharacterLimit?: number;
    previousResponseId?: string;
    targetLanguage?: string;
    reusableFactFindings?: FactCheckFinding[];
}
