import type { Article, ArticleDraft } from "@skladno/shared";

export class ArticleRevisionConflictError extends Error {
    constructor(public readonly article: Article) {
        super("Article has a newer revision.");
    }
}


export class ArticleDraftConflictError extends Error {
    constructor(
        public readonly article: Article,
        public readonly draft?: ArticleDraft,
    ) {
        super("Article Draft has a newer checkpoint.");
    }
}
