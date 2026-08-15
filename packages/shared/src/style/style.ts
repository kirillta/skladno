export const styleCorpusPath = "/api/style-corpus";
export const styleCorpusRulesPath = `${styleCorpusPath}/rules`;
export const styleCorpusRebuildPath = `${styleCorpusPath}/rebuild`;
export const articleStyleRulesPath = (articleId: string) => `/api/articles/${encodeURIComponent(articleId)}/style-rules`;


export interface StyleTrait {
    id: string;
    label: string;
    evidence: string;
}


export interface StyleProfile {
    version: number;
    corpusItemCount: number;
    characterCount: number;
    confidence: "low" | "medium" | "high";
    traits: StyleTrait[];
    phrasesToAvoid: string[];
    contributorIds: string[];
    rules: string;
    updatedAt: string;
}


export interface StyleCorpusItem {
    id: string;
    name: string;
    characterCount: number;
    wordCount: number;
    excerpt: string;
    createdAt: string;
    updatedAt: string;
    included: boolean;
    origin: "manual" | "import" | "article-revision";
    articleId?: string;
    revisionId?: string;
}


export interface StyleCorpus {
    items: StyleCorpusItem[];
    profile?: StyleProfile;
    rules: string;
    status: "empty" | "outdated" | "ready";
}


export interface CreateStyleCorpusItemInput {
    name?: string;
    content: string;
    origin?: "manual" | "import";
}


export interface StyleCorpusClient {
    getStyleCorpus(): Promise<StyleCorpus>;
    addStyleCorpusItem(input: CreateStyleCorpusItemInput): Promise<StyleCorpus>;
    setStyleCorpusItemIncluded(itemId: string, included: boolean): Promise<StyleCorpus>;
    setStyleCorpusRules(rules: string): Promise<StyleCorpus>;
    rebuildStyleCorpus(): Promise<StyleCorpus>;
    removeStyleCorpusItem(materialId: string): Promise<void>;
}


export interface ArticleStyleRulesClient {
    getArticleStyleRules(articleId: string): Promise<string>;
    setArticleStyleRules(articleId: string, rules: string): Promise<string>;
}
