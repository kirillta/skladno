import { useEffect, useState } from "react";
import { getPublishingLength, type Article, type PublishLimitProfile, type TranslationMetadata } from "@skladno/shared";
import { AlignedParagraphsIcon, SideBySideIcon } from "../../ui/icons.js";
import { Banner, Button, EmptyState, IconButton, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { providerLanguageName } from "../state/editorial-language.js";


function paragraphs(content: string): string[] {
    return content.split(/\n\s*\n|(?=^\s*(?:#{1,6}\s|[-*+]\s+|\d+\.\s))/m).map((paragraph) => paragraph.trim()).filter(Boolean);
}


export function TranslationsView({ article, sourceArticle, linkedTranslations = [], translations = [], stale, create, edit, openArticle, translate, translationLanguages = [], publishProfile, publishProfileLabel }: {
    article: Article;
    sourceArticle?: Article;
    linkedTranslations?: readonly Article[];
    translations?: readonly { metadata: TranslationMetadata; content: string; baseRevisionId: string }[];
    stale: boolean;
    create: (targetLanguage: string) => Promise<void>;
    edit?: () => void;
    openArticle?: (articleId: string) => void;
    translate: () => void;
    translationLanguages?: readonly string[];
    publishProfile?: PublishLimitProfile;
    publishProfileLabel?: string;
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
        void create(translation.metadata.targetLanguage).then(() => {
            setCreating(false);
            edit?.();
        }, () => setCreating(false));
    };
    const source = sourceArticle ?? article;
    const translatedContent = translation?.content ?? (sourceArticle ? article.currentRevision.content : undefined);
    const targetLanguage = providerLanguageName(translation?.metadata.targetLanguage ?? article.language ?? "");
    const sourceParagraphs = paragraphs(source.currentRevision.content);
    const translatedParagraphs = translatedContent ? paragraphs(translatedContent) : [];
    const paragraphCount = Math.max(sourceParagraphs.length, translatedParagraphs.length);
    const publishingGuidance = translatedContent && publishProfile
        ? { length: getPublishingLength(translatedContent, publishProfile), profile: publishProfile }
        : undefined;

    return <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
        <header className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.translations" })}</h2>
                <p className="mt-1 text-xs text-muted">{translationLanguages.length ? intl.formatMessage({ id: "views.translationTargets" }) : intl.formatMessage({ id: "views.translationTargetsEmpty" })}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {translatedContent && <div className="flex items-center gap-1" aria-label={intl.formatMessage({ id: "views.translationDisplayMode" })}>
                    <IconButton className={displayMode === "side-by-side" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"} label={intl.formatMessage({ id: "views.translationSideBySide" })} title={intl.formatMessage({ id: "views.translationSideBySide" })} aria-pressed={displayMode === "side-by-side"} onClick={() => setDisplayMode("side-by-side")}>
                        <SideBySideIcon />
                    </IconButton>
                    <IconButton className={displayMode === "aligned" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"} label={intl.formatMessage({ id: "views.translationAligned" })} title={intl.formatMessage({ id: "views.translationAligned" })} aria-pressed={displayMode === "aligned"} onClick={() => setDisplayMode("aligned")}>
                        <AlignedParagraphsIcon />
                    </IconButton>
                </div>}
                {sourceArticle && edit && <Button variant="secondary" onClick={edit}>{intl.formatMessage({ id: "views.editTranslation" })}</Button>}
                {translation && <Button variant="secondary" state={creating ? "loading" : "default"} disabled={stale || creating} onClick={startCreate}>{intl.formatMessage({ id: "views.editTranslationLanguage" }, { language: translation.metadata.targetLanguage })}</Button>}
                <Button disabled={!translationLanguages.length} onClick={translate}>{intl.formatMessage({ id: "views.translate" })}</Button>
            </div>
        </header>
        {translations.length > 1 && <TabList className="mt-4">
            {translations.map((item) => <Tab key={item.metadata.targetLanguage} selected={item.metadata.targetLanguage === translation?.metadata.targetLanguage} onClick={() => setSelectedTargetLanguage(item.metadata.targetLanguage)}>{item.metadata.targetLanguage}</Tab>)}
        </TabList>}
        {linkedTranslations.length > 0 && openArticle && <nav className="mt-3 flex items-center gap-2" aria-label={intl.formatMessage({ id: "views.existingTranslations" })}>
            <span className="text-xs font-semibold text-muted">{intl.formatMessage({ id: "views.existingTranslations" })}</span>
            {linkedTranslations.map((linked) => <Button key={linked.id} variant="quiet" onClick={() => openArticle(linked.id)}>{intl.formatMessage({ id: "views.openTranslation" }, { language: providerLanguageName(linked.language ?? ""), title: linked.title })}</Button>)}
        </nav>}
        {sourceArticle && openArticle && <p className="mt-1 text-xs text-muted">
            {intl.formatMessage({ id: "views.sourceLinkedPrefix" })} <button type="button" className="font-semibold text-brand underline underline-offset-2" onClick={() => openArticle(sourceArticle.id)}>{sourceArticle.title}</button>{article.sourceRevisionNumber ? ` ${intl.formatMessage({ id: "views.sourceLinkedRevision" }, { revisionNumber: article.sourceRevisionNumber })}` : null}
        </p>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
        {publishingGuidance && <p className={`mt-3 text-xs ${publishingGuidance.length.state === "over-limit" ? "font-semibold text-danger" : publishingGuidance.length.state === "near-limit" ? "font-semibold text-warning" : "text-muted"}`} aria-live="polite">
            <span>{intl.formatMessage({ id: "views.translationPublishingGuidance" }, { profile: publishProfileLabel })}</span>
            <span>{` · ${intl.formatMessage({ id: "publishing.characterCount" }, { count: intl.formatNumber(publishingGuidance.length.count) })}`}</span>
            {publishingGuidance.profile.characterLimit !== undefined && <span>{` / ${intl.formatNumber(publishingGuidance.profile.characterLimit)} · ${publishingGuidance.length.remaining! < 0 ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(publishingGuidance.length.remaining!)) }) : intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(publishingGuidance.length.remaining!) })}`}</span>}
        </p>}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            {!translatedContent
                ? <EmptyState title={intl.formatMessage({ id: "views.translationEmptyTitle" })}>{intl.formatMessage({ id: "views.translationEmpty" })}</EmptyState>
                : <>
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
        </div>
    </div>;
}
