export interface ArticleRevision {
    id: string;
    articleId: string;
    content: string;
    createdAt: string;
    provenance: Record<string, unknown>;
    restoredFromRevisionId?: string;
}


export interface Article {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    currentRevisionId: string;
    currentRevision: ArticleRevision;
    language?: string;
    audience?: string;
    publishingProfileId?: string;
    sourceArticleId?: string;
    sourceRevisionId?: string;
}


export interface CreateArticleInput {
    id?: string;
    title: string;
    content: string;
    provenance?: Record<string, unknown>;
    language?: string;
    audience?: string;
    publishingProfileId?: string;
    sourceArticleId?: string;
    sourceRevisionId?: string;
}


/** A compare-and-swap draft write. A conflict means another writer saved first. */
export interface SaveArticleRevisionInput {
    content: string;
    baseRevisionId: string;
}


export interface AcceptedChange {
    content: string;
    provenance: Record<string, unknown>;
}
