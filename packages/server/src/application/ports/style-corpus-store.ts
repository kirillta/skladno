import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";


export interface StyleCorpusStore {
    getStyleCorpus(): StyleCorpus;
    addStyleCorpusItem(input: CreateStyleCorpusItemInput): StyleCorpus;
    removeStyleCorpusItem(materialId: string): void;
}
