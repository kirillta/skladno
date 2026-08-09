export interface ArticleDraft {
    articleId: string;
    content: string;
    baseRevisionId: string;
    version: number;
    updatedAt: string;
}


/** A compare-and-swap mutable checkpoint. Omit expectedDraftVersion to create the first checkpoint. */
export interface SaveArticleDraftInput {
    content: string;
    baseRevisionId: string;
    expectedDraftVersion?: number;
}
