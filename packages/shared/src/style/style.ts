export const styleCorpusPath = "/api/style-corpus";


export interface StyleTrait {
    id: string;
    label: string;
    evidence: string;
}


export interface StyleProfile {
    corpusItemCount: number;
    characterCount: number;
    confidence: "low" | "medium" | "high";
    traits: StyleTrait[];
    updatedAt: string;
}


export interface StyleCorpusItem {
    id: string;
    name: string;
    characterCount: number;
    createdAt: string;
    updatedAt: string;
}


export interface StyleCorpus {
    items: StyleCorpusItem[];
    profile?: StyleProfile;
}


export interface CreateStyleCorpusItemInput {
    name: string;
    content: string;
}


export interface StyleCorpusClient {
    getStyleCorpus(): Promise<StyleCorpus>;
    addStyleCorpusItem(input: CreateStyleCorpusItemInput): Promise<StyleCorpus>;
    removeStyleCorpusItem(materialId: string): Promise<void>;
}
