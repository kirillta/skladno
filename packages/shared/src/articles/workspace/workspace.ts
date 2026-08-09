import type { Article, CreateArticleInput, UpdateArticleInput } from "../article/article.js";
import type { ArticleDraft, SaveArticleDraftInput } from "../draft/draft.js";
import type { ArticleRevision, SaveArticleRevisionInput } from "../revision/revision.js";
import type { RevisionClient } from "../revision/revisions.js";
import type { AssistantClient, AssistantMessage } from "../../assistant/assistant.js";

export const articlesPath = "/api/articles";

/** The transport-neutral operations required by the author workspace. */
export interface ArticleLibraryClient extends RevisionClient, AssistantClient {
    listArticles(): Promise<Article[]>;
    createArticle(input: CreateArticleInput): Promise<Article>;
    updateArticle(articleId: string, input: UpdateArticleInput): Promise<Article>;
    deleteArticle(articleId: string): Promise<void>;
    saveArticleDraft(articleId: string, input: SaveArticleDraftInput): Promise<ArticleDraft>;
    discardArticleDraft(articleId: string, expectedDraftVersion: number): Promise<void>;
    saveArticleRevision(articleId: string, input: SaveArticleRevisionInput): Promise<ArticleRevision>;
    listAssistantMessages(articleId: string): Promise<AssistantMessage[]>;
}


export class ArticleDraftConflictError extends Error {
    constructor(
        public readonly article: Article,
        public readonly draft?: ArticleDraft,
    ) {
        super("This draft checkpoint was changed by another save. Reload it and try again.");
        this.name = "ArticleDraftConflictError";
    }
}

export class ArticleRevisionConflictError extends Error {
    constructor(public readonly article: Article) {
        super("This article was changed by another save. Reload it and try again.");
        this.name = "ArticleRevisionConflictError";
    }
}
