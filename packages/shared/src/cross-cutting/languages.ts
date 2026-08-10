export const ARTICLE_LANGUAGE = {
    ENGLISH: "en",
    SPANISH: "es",
    PORTUGUESE: "pt",
    RUSSIAN: "ru",
    FRENCH: "fr",
    GERMAN: "de",
    ITALIAN: "it",
} as const;

export type ArticleLanguage = typeof ARTICLE_LANGUAGE[keyof typeof ARTICLE_LANGUAGE];

export const articleLanguages: readonly ArticleLanguage[] = Object.values(ARTICLE_LANGUAGE);

export function isArticleLanguage(value: unknown): value is ArticleLanguage {
    return typeof value === "string" && articleLanguages.includes(value as ArticleLanguage);
}
