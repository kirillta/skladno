import type { Article, PublishLimitProfile, TranslationMetadata } from "@skladno/shared";


export interface TranslationsData {
    article: Article;
    sourceArticle?: Article;
    linkedTranslations?: readonly Article[];
    translations?: readonly { metadata: TranslationMetadata; content: string; baseRevisionId: string; editorialArtifactId?: string }[];
    stale: boolean;
    translationLanguages?: readonly string[];
    publishProfile?: PublishLimitProfile;
    publishProfileLabel?: string;
    selectedTargetLanguage?: string;
}
