import type { ArticleDraft } from "../draft/draft.js";
import type { ArticleRevision } from "../revision/revision.js";


export interface Article {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    currentRevisionId: string;
    currentRevision: ArticleRevision;
    draft?: ArticleDraft;
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


/** An Article-level change that never affects its immutable Revision history. */
export interface UpdateArticleInput {
    title?: string;
    language?: string;
    publishingProfileId?: string;
}
