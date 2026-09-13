import { APPLICATION_ERROR, type Article, type ArticleDraft } from "@skladno/shared";


export class ArticleDraftConflictError extends Error {
    constructor(
        public readonly article: Article,
        public readonly draft?: ArticleDraft,
    ) {
        super(APPLICATION_ERROR.DRAFT_CONFLICT);
    }
}
