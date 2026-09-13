import { beginTelemetryCapture, type AcceptedChange, type AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";

import type { ArticleStore } from "./article-store.js";
import type { AssistantGreetingStore } from "./assistant-greeting-store.js";
import type { TelemetryObserver } from "../telemetry/telemetry-observer.js";


export class ArticleService {
    constructor(
        private readonly store: ArticleStore,
        private readonly assistant: AssistantGreetingStore,
        private readonly telemetry?: TelemetryObserver,
    ) { }


    listArticles(): Article[] {
        return this.store.listArticles();
    }


    createArticle(input: CreateArticleInput): Article {
        const article = this.store.createArticle(input);
        this.assistant.ensureGreeting(article.id);

        return article;
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


    setArticleArchived(articleId: string, archived: boolean): Article[] {
        return this.store.setArticleArchived(articleId, archived);
    }


    setArticlePinned(articleId: string, pinned: boolean): Article {
        return this.store.setArticlePinned(articleId, pinned);
    }


    reorderPinnedArticles(articleIds: string[]): Article[] {
        return this.store.reorderPinnedArticles(articleIds);
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
        return this.store.appendArticleRevision(articleId, change.content, change.provenance);
    }


    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision {
        return this.store.acceptProposal(articleId, input);
    }


    restoreRevision(articleId: string, revisionId: string): ArticleRevision {
        const capture = beginTelemetryCapture(this.telemetry);
        try {
            const revision = this.store.restoreRevision(articleId, revisionId);
            capture({ kind: "recovery_finished", recovery: "revision", outcome: "completed" });
            return revision;
        } catch (error) {
            capture({ kind: "recovery_finished", recovery: "revision", outcome: "failed", failure: "unknown" });
            throw error;
        }
    }
}
