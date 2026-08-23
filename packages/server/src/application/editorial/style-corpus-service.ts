import { APPLICATION_ERROR, HTTP_STATUS, type CreateStyleCorpusItemInput, type StyleCorpus } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";
import type { ArticleStore } from "../ports/article-store.js";


export class StyleCorpusService {
    constructor(private readonly store: StyleCorpusStore, private readonly engines?: EditorialEngineResolver, private readonly articles?: ArticleStore) { }


    get(): StyleCorpus {
        return this.store.get();
    }


    async add(input: CreateStyleCorpusItemInput, signal: AbortSignal): Promise<StyleCorpus> {
        if (!input.content.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        if (this.store.hasContent(input.content))
            throw new ApplicationServiceError(APPLICATION_ERROR.DUPLICATE_STYLE_CORPUS_ITEM, HTTP_STATUS.BAD_REQUEST);

        const name = input.name?.trim();
        if (name)
            return this.store.add({ ...input, name });

        const generator = this.engines?.resolveArticleTitleGenerator?.();
        if (!generator)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        const generatedName = (await generator.generate(input.content, signal)).trim();
        if (!generatedName)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        return this.store.add({ ...input, name: generatedName });
    }


    setIncluded(id: string, included: boolean): StyleCorpus {
        return this.store.setIncluded(id, included);
    }


    setRules(rules: string): StyleCorpus {
        return this.store.setRules(rules);
    }


    rebuild(): StyleCorpus {
        return this.store.rebuild();
    }


    getArticleRules(articleId: string): string {
        return this.store.getArticleRules(articleId);
    }


    setArticleRules(articleId: string, rules: string): string {
        return this.store.setArticleRules(articleId, rules);
    }


    addArticleRevision(articleId: string, revisionId: string): StyleCorpus {
        const article = this.articles?.get(articleId);
        const revision = this.articles?.getRevision(articleId, revisionId);
        if (!article || !revision)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        if (this.store.hasContent(revision.content))
            throw new ApplicationServiceError(APPLICATION_ERROR.DUPLICATE_STYLE_CORPUS_ITEM, HTTP_STATUS.BAD_REQUEST);

        const revisionNumber = this.articles!.listRevisions(articleId).findIndex((item) => item.id === revisionId) + 1;
        return this.store.add({ name: `${article.title} — Revision ${revisionNumber}`, content: revision.content, origin: "article-revision", articleId, revisionId });
    }


    remove(materialId: string): void {
        this.store.remove(materialId);
    }
}
