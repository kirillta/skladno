import { type AcceptedChange, type AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";

import type { ArticleStore, AssistantGreetingStore } from "../../ports/article-store.js";
import type { TelemetryObserver } from "../../ports/telemetry-observer.js";


export class ArticleService {
    constructor(
        private readonly store: ArticleStore,
        private readonly assistant: AssistantGreetingStore,
        private readonly telemetry?: TelemetryObserver,
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


    setArticleArchived(articleId: string, archived: boolean): Article[] {
        return this.store.setArchived(articleId, archived);
    }


    setArticlePinned(articleId: string, pinned: boolean): Article {
        return this.store.setPinned(articleId, pinned);
    }


    reorderPinnedArticles(articleIds: string[]): Article[] {
        return this.store.reorderPinned(articleIds);
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
        return this.store.acceptProposal(articleId, input);
    }


    restoreRevision(articleId: string, revisionId: string): ArticleRevision {
        const capture = this.telemetry?.beginCapture() ?? (() => undefined);
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
