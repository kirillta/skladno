import type { Article } from "@skladno/shared";


export class ArticleRevisionConflictError extends Error {
    constructor(public readonly article: Article) {
        super("Article has a newer revision.");
    }
}
