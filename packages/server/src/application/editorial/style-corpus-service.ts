import { APPLICATION_ERROR, HTTP_STATUS, type CreateStyleCorpusItemInput, type StyleCorpus } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


export class StyleCorpusService {
    constructor(private readonly store: StyleCorpusStore, private readonly engines?: EditorialEngineResolver) { }


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

        const generator = this.engines?.resolveSourceNameGenerator?.();
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


    remove(materialId: string): void {
        this.store.remove(materialId);
    }
}
