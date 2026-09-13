import { APPLICATION_ERROR, type Article } from "@skladno/shared";


export class ArticleRevisionConflictError extends Error {
    constructor(public readonly article: Article) {
        super(APPLICATION_ERROR.REVISION_CONFLICT);
    }
}
