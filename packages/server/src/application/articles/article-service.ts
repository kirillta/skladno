import type { AcceptedChange, AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";

import type { ArticleStore } from "../ports/article-store.js";


export class ArticleService {
    constructor(private readonly store: ArticleStore) { }


    listArticles(): Article[] {
        return this.store.listArticles();
    }


    createArticle(input: CreateArticleInput): Article {
        return this.store.createArticle(input);
    }


    getArticle(articleId: string): Article | undefined {
        return this.store.getArticle(articleId);
    }


    updateArticle(articleId: string, input: UpdateArticleInput): Article {
        return this.store.updateArticle(articleId, input);
    }


    deleteArticle(articleId: string): void {
        this.store.deleteArticle(articleId);
    }


    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft {
        return this.store.saveArticleDraft(articleId, input);
    }


    discardDraft(articleId: string, expectedDraftVersion: number): void {
        this.store.discardArticleDraft(articleId, expectedDraftVersion);
    }


    saveRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision {
        return this.store.saveArticleRevision(articleId, input);
    }


    listRevisions(articleId: string): ArticleRevision[] {
        return this.store.listArticleRevisions(articleId);
    }


    acceptChange(articleId: string, change: AcceptedChange): ArticleRevision {
        return this.store.acceptChange(articleId, change);
    }


    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision {
        return this.store.acceptProposal(articleId, input);
    }


    restoreRevision(articleId: string, revisionId: string): ArticleRevision {
        return this.store.restoreRevision(articleId, revisionId);
    }
}
