import { useState } from "react";
import type { Article, TranslationMetadata } from "@skladno/shared";
import { Banner, Button, EmptyState, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

const languageMessageIds = {
    en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian",
} as const;


export function TranslationsView({ article, sourceArticle, translation, translationContent, sourceRevisionId, stale, create, translate, translationLanguages = [] }: {
    article: Article;
    sourceArticle?: Article;
    translation: TranslationMetadata | undefined;
    translationContent?: string;
    sourceRevisionId?: string;
    stale: boolean;
    create: () => Promise<void>;
    translate: () => void;
    translationLanguages?: readonly string[];
}) {
    const intl = useIntl();
    const [creating, setCreating] = useState(false);
    const [visibleText, setVisibleText] = useState<"source" | "translation">("source");
    const startCreate = () => {
        setCreating(true);
        void create().then(() => setCreating(false), () => setCreating(false));
    };
    const source = sourceArticle ?? article;
    const translatedContent = translationContent ?? (sourceArticle ? article.currentRevision.content : undefined);
    const targetLanguage = translation?.targetLanguage ?? article.language;
    const targets = translationLanguages.flatMap((language) => languageMessageIds[language as keyof typeof languageMessageIds] ? [intl.formatMessage({ id: languageMessageIds[language as keyof typeof languageMessageIds] })] : []).join(", ");

    return <div className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.translations" })}</h2><p className="mt-1 text-sm text-muted">{targets ? intl.formatMessage({ id: "views.translationTargets" }, { languages: targets }) : intl.formatMessage({ id: "views.translationTargetsEmpty" })}</p></div><Button disabled={!translationLanguages.length} onClick={translate}>{intl.formatMessage({ id: "views.translate" })}</Button></header>
        {translatedContent && <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.translationPair" }, { source: source.language, target: targetLanguage })}</p>}
        {sourceRevisionId && <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.sourceLinked" }, { revisionId: sourceRevisionId.slice(0, 8) })}</p>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
        {!translatedContent
            ? <EmptyState title={intl.formatMessage({ id: "views.translationEmptyTitle" })}>{intl.formatMessage({ id: "views.translationEmpty" })}</EmptyState>
            : <>
                <TabList className="mt-4 lg:hidden">
                    <Tab selected={visibleText === "source"} onClick={() => setVisibleText("source")}>{intl.formatMessage({ id: "views.translationOriginal" })}</Tab>
                    <Tab selected={visibleText === "translation"} onClick={() => setVisibleText("translation")}>{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</Tab>
                </TabList>
                <div className="grid gap-4 lg:grid-cols-2">
                    <article className={`${visibleText === "source" ? "block" : "hidden"} mt-4 min-w-0 rounded-panel border border-border bg-surface-raised p-4 lg:block`}>
                        <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationOriginal" })}</h3>
                        <pre className="mt-3 whitespace-pre-wrap font-serif text-sm leading-7 text-ink">{source.currentRevision.content}</pre>
                    </article>
                    <article className={`${visibleText === "translation" ? "block" : "hidden"} mt-4 min-w-0 rounded-panel border border-border bg-surface-raised p-4 lg:block`}>
                        <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</h3>
                        <pre className="mt-3 whitespace-pre-wrap font-serif text-sm leading-7 text-ink">{translatedContent}</pre>
                    </article>
                </div>
                {translation?.protectedSpans.length ? <Banner className="mt-4" tone="info">
                    <span>{intl.formatMessage({ id: "views.translationProtected" })}: {translation.protectedSpans.join(", ")}</span>
                </Banner> : null}
            </>}
        {translation && <Button className="mt-4" state={creating ? "loading" : "default"} disabled={stale || creating} onClick={startCreate}>{intl.formatMessage({ id: "views.createTranslation" }, { language: translation.targetLanguage })}</Button>}
    </div>;
}
