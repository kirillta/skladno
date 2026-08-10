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


    remove(materialId: string): void {
        this.store.remove(materialId);
    }
}
