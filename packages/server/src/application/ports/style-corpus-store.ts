import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";


export interface StyleCorpusStore {
    get(): StyleCorpus;
    hasContent(content: string): boolean;
    add(input: CreateStyleCorpusItemInput & { name: string; origin?: "manual" | "import" | "article-revision"; articleId?: string; revisionId?: string }): StyleCorpus;
    setIncluded(id: string, included: boolean): StyleCorpus;
    setRules(rules: string): StyleCorpus;
    rebuild(): StyleCorpus;
    getArticleRules(articleId: string): string;
    setArticleRules(articleId: string, rules: string): string;
    remove(materialId: string): void;
}
