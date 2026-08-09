import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";

import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


export class StyleCorpusService {
    constructor(private readonly store: StyleCorpusStore) { }


    get(): StyleCorpus {
        return this.store.getStyleCorpus();
    }


    add(input: CreateStyleCorpusItemInput): StyleCorpus {
        return this.store.addStyleCorpusItem(input);
    }


    remove(materialId: string): void {
        this.store.removeStyleCorpusItem(materialId);
    }
}
