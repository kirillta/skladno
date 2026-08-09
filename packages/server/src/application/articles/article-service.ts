import type { AcceptedChange, AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";

import type { ArticleStore, AssistantGreetingStore } from "../ports/article-store.js";


export class ArticleService {
    constructor(
        private readonly store: ArticleStore,
        private readonly assistant: AssistantGreetingStore,
    ) { }


    listArticles(): Article[] {
        return this.store.list();
    }


    createArticle(input: CreateArticleInput): Article {
        const article = this.store.create(input);
        this.assistant.ensureGreeting(article.id);

        return article;
    }


    getArticle(articleId: string): Article | undefined {
        return this.store.get(articleId);
    }


    updateArticle(articleId: string, input: UpdateArticleInput): Article {
        return this.store.update(articleId, input);
    }


    deleteArticle(articleId: string): void {
        this.store.delete(articleId);
    }


    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft {
        return this.store.saveDraft(articleId, input);
    }


    discardDraft(articleId: string, expectedDraftVersion: number): void {
        this.store.discardDraft(articleId, expectedDraftVersion);
    }


    saveRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision {
        return this.store.saveRevision(articleId, input);
    }


    listRevisions(articleId: string): ArticleRevision[] {
        return this.store.listRevisions(articleId);
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
