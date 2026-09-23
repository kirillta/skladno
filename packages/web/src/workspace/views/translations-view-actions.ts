export interface TranslationsActions {
    create: (targetLanguage: string) => Promise<void>;
    reject?: (targetLanguage: string) => Promise<void>;
    edit?: () => void;
    openArticle?: (articleId: string) => void;
    selectTargetLanguage?: (language: string) => void;
    translate: () => void;
}
