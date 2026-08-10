import { REVISION_PROVENANCE_KIND, type AcceptedChange, type AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";

import { ArticleRevisionConflictError } from "../errors/article-revision-conflict-error.js";

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
        return this.store.appendRevision(articleId, change.content, change.provenance);
    }


    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision {
        const article = this.requireArticle(articleId);
        if (article.currentRevisionId !== input.baseRevisionId)
            throw new ArticleRevisionConflictError(article);

        return this.store.appendRevision(articleId, input.content, input.provenance);
    }


    restoreRevision(articleId: string, revisionId: string): ArticleRevision {
        const revision = this.store.getRevision(articleId, revisionId);
        if (!revision)
            throw new Error("Revision not found for this article.");

        return this.store.appendRevision(articleId, revision.content, { kind: REVISION_PROVENANCE_KIND.RESTORE, restoredFromRevisionId: revisionId }, revisionId);
    }


    private requireArticle(articleId: string): Article {
        const article = this.store.get(articleId);
        if (!article)
            throw new Error("Article not found.");

        return article;
    }
}
