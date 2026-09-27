import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";


export interface EditorialServiceRequest {
    articleId: string;
    requestId: string;
    skipFactCheckClaim?: (claim: string) => boolean;
    operation: EditorialOperation;
    authorContext: string;
    skillId?: BuiltInSkillId;
    targetArticleCharacterLimit?: number;
    targetLanguage?: string;
    articleContent?: string;
    articleSelection?: boolean;
    surroundingArticleCharacterCount?: number;
    correctionSelection?: { expectedRevisionId: string; occurrenceIds: string[] };
}
