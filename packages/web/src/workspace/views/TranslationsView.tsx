import { useEffect, useState } from "react";
import type { Article, TranslationMetadata } from "@skladno/shared";
import { Banner, Button, EmptyState, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

const languageMessageIds = {
    en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian",
} as const;


function paragraphs(content: string): string[] {
    return content.split(/\n\s*\n|(?=^\s*(?:#{1,6}\s|[-*+]\s+|\d+\.\s))/m).map((paragraph) => paragraph.trim()).filter(Boolean);
}


export function TranslationsView({ article, sourceArticle, translations = [], sourceRevisionId, stale, create, translate, translationLanguages = [] }: {
    article: Article;
    sourceArticle?: Article;
    translations?: readonly { metadata: TranslationMetadata; content: string; baseRevisionId: string }[];
    sourceRevisionId?: string;
    stale: boolean;
    create: (targetLanguage: string) => Promise<void>;
    translate: () => void;
    translationLanguages?: readonly string[];
}) {
    const intl = useIntl();
    const [creating, setCreating] = useState(false);
    const [displayMode, setDisplayMode] = useState<"side-by-side" | "aligned">("side-by-side");
    const [visibleText, setVisibleText] = useState<"source" | "translation">("source");
    const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string>();
    const translation = translations.find((item) => item.metadata.targetLanguage === selectedTargetLanguage) ?? translations.at(-1);
    useEffect(() => {
        if (!translation && translations.length)
            setSelectedTargetLanguage(translations.at(-1)?.metadata.targetLanguage);
    }, [translation, translations]);
    const startCreate = () => {
        if (!translation)
            return;

        setCreating(true);
        void create(translation.metadata.targetLanguage).then(() => setCreating(false), () => setCreating(false));
    };
    const source = sourceArticle ?? article;
    const translatedContent = translation?.content ?? (sourceArticle ? article.currentRevision.content : undefined);
    const targetLanguage = translation?.metadata.targetLanguage ?? article.language;
    const targets = translationLanguages.flatMap((language) => languageMessageIds[language as keyof typeof languageMessageIds] ? [intl.formatMessage({ id: languageMessageIds[language as keyof typeof languageMessageIds] })] : []).join(", ");
    const sourceParagraphs = paragraphs(source.currentRevision.content);
    const translatedParagraphs = translatedContent ? paragraphs(translatedContent) : [];
    const paragraphCount = Math.max(sourceParagraphs.length, translatedParagraphs.length);

    return <div className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.translations" })}</h2>
                <p className="mt-1 text-xs text-muted">{targets ? intl.formatMessage({ id: "views.translationTargets" }, { languages: targets }) : intl.formatMessage({ id: "views.translationTargetsEmpty" })}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {translation && <Button variant="secondary" state={creating ? "loading" : "default"} disabled={stale || creating} onClick={startCreate}>{intl.formatMessage({ id: "views.createTranslation" }, { language: translation.metadata.targetLanguage })}</Button>}
                <Button disabled={!translationLanguages.length} onClick={translate}>{intl.formatMessage({ id: "views.translate" })}</Button>
            </div>
        </header>
        {translations.length > 1 && <TabList className="mt-4">
            {translations.map((item) => <Tab key={item.metadata.targetLanguage} selected={item.metadata.targetLanguage === translation?.metadata.targetLanguage} onClick={() => setSelectedTargetLanguage(item.metadata.targetLanguage)}>{item.metadata.targetLanguage}</Tab>)}
        </TabList>}
        {sourceRevisionId && <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "views.sourceLinked" }, { revisionId: sourceRevisionId.slice(0, 8) })}</p>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
        {!translatedContent
            ? <EmptyState title={intl.formatMessage({ id: "views.translationEmptyTitle" })}>{intl.formatMessage({ id: "views.translationEmpty" })}</EmptyState>
            : <>
                <TabList className="mt-4">
                    <Tab selected={displayMode === "side-by-side"} onClick={() => setDisplayMode("side-by-side")}>{intl.formatMessage({ id: "views.translationSideBySide" })}</Tab>
                    <Tab selected={displayMode === "aligned"} onClick={() => setDisplayMode("aligned")}>{intl.formatMessage({ id: "views.translationAligned" })}</Tab>
                </TabList>
                {displayMode === "side-by-side"
                    ? <>
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
                    </>
                    : <div className="mt-4 overflow-hidden rounded-panel border border-border bg-surface-raised">
                        <div className="grid gap-4 border-b border-border px-4 py-3 md:grid-cols-2"><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationOriginal" })}</h3><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</h3></div>
                        {Array.from({ length: paragraphCount }, (_, index) => <div className="grid gap-4 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-2" key={index}>
                            <pre className="whitespace-pre-wrap font-serif text-sm leading-7 text-ink">{sourceParagraphs[index] ?? <span className="font-ui text-xs italic text-muted">{intl.formatMessage({ id: "views.translationMissingOriginal" })}</span>}</pre>
                            <pre className="whitespace-pre-wrap font-serif text-sm leading-7 text-ink">{translatedParagraphs[index] ?? <span className="font-ui text-xs italic text-muted">{intl.formatMessage({ id: "views.translationMissingResult" })}</span>}</pre>
                        </div>)}
                    </div>}
                {translation?.metadata.protectedSpans.length ? <Banner className="mt-4" tone="info">
                    <span>{intl.formatMessage({ id: "views.translationProtected" })}: {translation.metadata.protectedSpans.join(", ")}</span>
                </Banner> : null}
            </>}
    </div>;
}
