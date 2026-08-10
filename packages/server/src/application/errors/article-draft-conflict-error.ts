import type { Article, ArticleDraft } from "@skladno/shared";


export class ArticleDraftConflictError extends Error {
    constructor(
        public readonly article: Article,
        public readonly draft?: ArticleDraft,
    ) {
        super("Article Draft has a newer checkpoint.");
    }
}
