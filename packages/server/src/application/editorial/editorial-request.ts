import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";


export interface EditorialServiceRequest {
    articleId: string;
    requestId: string;
    operation: EditorialOperation;
    authorContext: string;
    skillId?: BuiltInSkillId;
    targetArticleCharacterLimit?: number;
    targetLanguage?: string;
    articleContent?: string;
    articleSelection?: boolean;
    surroundingArticleCharacterCount?: number;
}
