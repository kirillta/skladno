import type { CreateArticleInput, Article, ArticleRevision, SaveArticleRevisionInput } from "./persistence/articles.js";
import type { RevisionClient } from "./revisions.js";

export const articlesPath = "/api/articles";

/** The transport-neutral operations required by the author workspace. */
export interface ArticleLibraryClient extends RevisionClient {
    listArticles(): Promise<Article[]>;
    createArticle(input: CreateArticleInput): Promise<Article>;
    renameArticle(articleId: string, title: string): Promise<Article>;
    deleteArticle(articleId: string): Promise<void>;
    saveArticleRevision(articleId: string, input: SaveArticleRevisionInput): Promise<ArticleRevision>;
}

export class ArticleRevisionConflictError extends Error {
    constructor(public readonly article: Article) {
        super("This article was changed by another save. Reload it and try again.");
        this.name = "ArticleRevisionConflictError";
    }
}
