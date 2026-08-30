import type { EditorialOperation } from "@skladno/shared";


export interface EditorialServiceRequest {
    articleId: string;
    requestId: string;
    operation: EditorialOperation;
    authorContext: string;
    targetLanguage?: string;
    articleContent?: string;
    articleSelection?: boolean;
    surroundingArticleCharacterCount?: number;
}
