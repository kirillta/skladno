import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";

import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


export class StyleCorpusService {
    constructor(private readonly store: StyleCorpusStore) { }


    get(): StyleCorpus {
        return this.store.get();
    }


    add(input: CreateStyleCorpusItemInput): StyleCorpus {
        return this.store.add(input);
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
