import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";


export interface StyleCorpusStore {
    get(): StyleCorpus;
    add(input: CreateStyleCorpusItemInput): StyleCorpus;
    remove(materialId: string): void;
}
