export const REVISION_PROVENANCE_KIND = {
    INITIAL: "initial",
    AUTHOR_DRAFT: "author-draft",
    ACCEPTED_PROPOSAL: "accepted-proposal",
    RESTORE: "restore",
} as const;


export type RevisionProvenanceKind = typeof REVISION_PROVENANCE_KIND[keyof typeof REVISION_PROVENANCE_KIND];


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
