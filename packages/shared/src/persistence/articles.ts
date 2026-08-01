export interface ArticleRevision {
    id: string;
    articleId: string;
    content: string;
    createdAt: string;
    provenance: Record<string, unknown>;
    restoredFromRevisionId?: string;
}


export interface ArticleDraft {
    articleId: string;
    content: string;
    baseRevisionId: string;
    version: number;
    updatedAt: string;
}


export interface Article {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    currentRevisionId: string;
    currentRevision: ArticleRevision;
    draft?: ArticleDraft;
    workflowStage: WorkflowStage;
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
    workflowStage?: WorkflowStage;
    language?: string;
    audience?: string;
    publishingProfileId?: string;
    sourceArticleId?: string;
    sourceRevisionId?: string;
}


/** An Article-level change that never affects its immutable Revision history. */
export interface UpdateArticleInput {
    title?: string;
    workflowStage?: WorkflowStage;
    language?: string;
    publishingProfileId?: string;
}


/** A compare-and-swap draft write. A conflict means another writer saved first. */
export interface SaveArticleRevisionInput {
    content: string;
    baseRevisionId: string;
    expectedDraftVersion?: number;
}


/** A compare-and-swap mutable checkpoint. Omit expectedDraftVersion to create the first checkpoint. */
export interface SaveArticleDraftInput {
    content: string;
    baseRevisionId: string;
    expectedDraftVersion?: number;
}


export interface AcceptedChange {
    content: string;
    provenance: Record<string, unknown>;
}
import type { WorkflowStage } from "../workflow-stage.js";
