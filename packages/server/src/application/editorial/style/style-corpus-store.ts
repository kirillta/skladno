import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";


export interface StyleCorpusStore {
    getStyleCorpus(): StyleCorpus;
    hasStyleCorpusContent(content: string): boolean;
    addStyleCorpusItem(input: CreateStyleCorpusItemInput & { name: string; origin?: "manual" | "import" | "article-revision"; articleId?: string; revisionId?: string }): StyleCorpus;
    setStyleCorpusItemIncluded(id: string, included: boolean): StyleCorpus;
    setStyleCorpusRules(rules: string): StyleCorpus;
    rebuildStyleProfile(): StyleCorpus;
    getArticleStyleRules(articleId: string): string;
    setArticleStyleRules(articleId: string, rules: string): string;
    removeStyleCorpusItem(materialId: string): void;
}
