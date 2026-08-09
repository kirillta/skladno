export interface ArticleRevision {
    id: string;
    articleId: string;
    content: string;
    createdAt: string;
    provenance: Record<string, unknown>;
    restoredFromRevisionId?: string;
}


/** A compare-and-swap revision write. A conflict means another writer saved first. */
export interface SaveArticleRevisionInput {
    content: string;
    baseRevisionId: string;
    expectedDraftVersion?: number;
}


export interface AcceptedChange {
    content: string;
    provenance: Record<string, unknown>;
}
