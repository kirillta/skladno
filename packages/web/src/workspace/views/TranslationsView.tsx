import { useState } from "react";
import { getPublishingLength, type Article, type PublishLimitProfile, type TranslationMetadata } from "@skladno/shared";
import { AlignedParagraphsIcon, SideBySideIcon } from "../../ui/icons.js";
import { Banner, Button, Dialog, EmptyState, IconButton, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { getProviderLanguageName } from "../state/editorial-language.js";


function splitParagraphs(content: string): string[] {
    return content.split(/\n\s*\n|(?=^\s*(?:#{1,6}\s|[-*+]\s+|\d+\.\s))/m).map((paragraph) => paragraph.trim()).filter(Boolean);
}


function getChangedProtectedSpans(content: string, protectedSpans: readonly string[]): string[] {
    const expectedCounts = new Map<string, number>();
    for (const span of protectedSpans)
        expectedCounts.set(span, (expectedCounts.get(span) ?? 0) + 1);

    return [...expectedCounts].flatMap(([span, expected]) => content.split(span).length - 1 === expected ? [] : [span]);
}


interface TranslationsData {
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


interface TranslationsActions {
    create: (targetLanguage: string) => Promise<void>;
    reject?: (targetLanguage: string) => Promise<void>;
    edit?: () => void;
    openArticle?: (articleId: string) => void;
    selectTargetLanguage?: (language: string) => void;
    translate: () => void;
}


export function TranslationsView({ data, actions }: { data: TranslationsData; actions: TranslationsActions }) {
    const { article, sourceArticle, linkedTranslations = [], translations = [], stale, translationLanguages = [], publishProfile, selectedTargetLanguage } = data;
    const { create, reject, edit, openArticle, selectTargetLanguage, translate } = actions;
    const intl = useIntl();
    const [creating, setCreating] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectConfirmationOpen, setRejectConfirmationOpen] = useState(false);
    const [displayMode, setDisplayMode] = useState<"side-by-side" | "aligned">("side-by-side");
    const [visibleText, setVisibleText] = useState<"source" | "translation">("source");
    const translation = translations.find((item) => item.metadata.targetLanguage === selectedTargetLanguage) ?? translations.at(-1);
    const startCreate = () => {
        if (!translation)
            return;

        setCreating(true);
        void create(translation.metadata.targetLanguage).then(() => {
            setCreating(false);
            edit?.();
        }, () => setCreating(false));
    };
    const confirmRejection = () => {
        if (!translation || !reject)
            return;

        setRejecting(true);
        void reject(translation.metadata.targetLanguage).then(() => {
            setRejecting(false);
            setRejectConfirmationOpen(false);
        }, () => setRejecting(false));
    };
    const source = sourceArticle ?? article;
    const translatedContent = translation?.content ?? (sourceArticle ? article.currentRevision.content : undefined);
    const targetLanguage = getProviderLanguageName(translation?.metadata.targetLanguage ?? article.language ?? "");
    const sourceParagraphs = splitParagraphs(source.currentRevision.content);
    const translatedParagraphs = translatedContent ? splitParagraphs(translatedContent) : [];
    const paragraphCount = Math.max(sourceParagraphs.length, translatedParagraphs.length);
    const publishingGuidance = translatedContent && publishProfile
        ? { length: getPublishingLength(translatedContent, publishProfile), profile: publishProfile }
        : undefined;
    const protectedSpanWarnings = translation ? getChangedProtectedSpans(translation.content, translation.metadata.protectedSpans) : [];
    const protectedSpansValid = protectedSpanWarnings.length === 0;

    return <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
        <header className="shrink-0">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.translations" })}</h2>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-muted">
                    <p>{translationLanguages.length ? intl.formatMessage({ id: "views.translationTargets" }) : intl.formatMessage({ id: "views.translationTargetsEmpty" })}</p>
                    {publishingGuidance && <p className="ml-auto flex flex-wrap items-center" aria-live="polite">
                        <span className={publishingGuidance.length.state === "over-limit" ? "font-semibold text-danger" : publishingGuidance.length.state === "near-limit" ? "font-semibold text-warning" : undefined}>{publishingGuidance.profile.characterLimit === undefined
                            ? intl.formatMessage({ id: "publishing.characterCount" }, { count: intl.formatNumber(publishingGuidance.length.count) })
                            : intl.formatMessage({ id: "views.characterCount" }, { count: intl.formatNumber(publishingGuidance.length.count), limit: intl.formatNumber(publishingGuidance.profile.characterLimit) })}</span>
                    </p>}
                </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                {translatedContent && <div className="flex items-center gap-1" aria-label={intl.formatMessage({ id: "views.translationDisplayMode" })}>
                    <IconButton variant="quiet" label={intl.formatMessage({ id: "views.translationSideBySide" })} title={intl.formatMessage({ id: "views.translationSideBySide" })} aria-pressed={displayMode === "side-by-side"} onClick={() => setDisplayMode("side-by-side")}>
                        <SideBySideIcon />
                    </IconButton>
                    <IconButton variant="quiet" label={intl.formatMessage({ id: "views.translationAligned" })} title={intl.formatMessage({ id: "views.translationAligned" })} aria-pressed={displayMode === "aligned"} onClick={() => setDisplayMode("aligned")}>
                        <AlignedParagraphsIcon />
                    </IconButton>
                </div>}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    {sourceArticle && edit && <Button variant="secondary" onClick={edit}>{intl.formatMessage({ id: "views.editTranslation" })}</Button>}
                    {translation && <Button variant="secondary" state={creating ? "loading" : "default"} disabled={stale || creating || !protectedSpansValid} onClick={startCreate}>{intl.formatMessage({ id: "views.editTranslationLanguage" }, { language: translation.metadata.targetLanguage })}</Button>}
                    {translation?.editorialArtifactId && reject && <Button variant="danger" disabled={creating || rejecting} onClick={() => setRejectConfirmationOpen(true)}>{intl.formatMessage({ id: "views.rejectTranslation" })}</Button>}
                    <Button disabled={!translationLanguages.length} onClick={translate}>{intl.formatMessage({ id: "views.translate" })}</Button>
                </div>
            </div>
        </header>
        {translations.length > 1 && <TabList className="mt-4">
            {translations.map((item) => <Tab key={item.metadata.targetLanguage} selected={item.metadata.targetLanguage === translation?.metadata.targetLanguage} onClick={() => selectTargetLanguage?.(item.metadata.targetLanguage)}>{item.metadata.targetLanguage}</Tab>)}
        </TabList>}
        {(linkedTranslations.length > 0 && openArticle || sourceArticle && openArticle) && <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
            {linkedTranslations.length > 0 && openArticle && <nav className="flex items-center gap-2" aria-label={intl.formatMessage({ id: "views.existingTranslations" })}>
                <span className="text-xs font-semibold text-muted">{intl.formatMessage({ id: "views.existingTranslations" })}</span>
                {linkedTranslations.map((linked) => <Button key={linked.id} variant="quiet" onClick={() => openArticle(linked.id)}>{intl.formatMessage({ id: "views.openTranslation" }, { language: getProviderLanguageName(linked.language ?? ""), title: linked.title })}</Button>)}
            </nav>}
            {sourceArticle && openArticle && <p className="text-xs text-muted">
                {intl.formatMessage({ id: "views.sourceLinkedPrefix" })} <button type="button" className="font-semibold text-brand underline underline-offset-2" onClick={() => openArticle(sourceArticle.id)}>{sourceArticle.title}</button>{article.sourceRevisionNumber ? ` ${intl.formatMessage({ id: "views.sourceLinkedRevision" }, { revisionNumber: article.sourceRevisionNumber })}` : null}
            </p>}
        </div>}
        {stale && <Banner className="mt-3" tone="warning">{intl.formatMessage({ id: "views.translationStale" })}</Banner>}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            {!translatedContent
                ? <EmptyState title={intl.formatMessage({ id: "views.translationEmptyTitle" })}>{intl.formatMessage({ id: "views.translationEmpty" })}</EmptyState>
                : <>
                    <div className="@container">
                        {displayMode === "side-by-side"
                            ? <>
                                <TabList className="mt-4 @[42rem]:hidden">
                                    <Tab selected={visibleText === "source"} onClick={() => setVisibleText("source")}>{intl.formatMessage({ id: "views.translationOriginal" })}</Tab>
                                    <Tab selected={visibleText === "translation"} onClick={() => setVisibleText("translation")}>{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</Tab>
                                </TabList>
                                <div className="grid gap-4 @[42rem]:grid-cols-2">
                                    <article className={`${visibleText === "source" ? "block" : "hidden"} mt-4 min-w-0 rounded-panel border border-border bg-surface-raised p-4 @[42rem]:block`}>
                                        <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationOriginal" })}</h3>
                                        <pre className="mt-3 whitespace-pre-wrap font-serif text-base leading-7 text-ink">{source.currentRevision.content}</pre>
                                    </article>
                                    <article className={`${visibleText === "translation" ? "block" : "hidden"} mt-4 min-w-0 rounded-panel border border-border bg-surface-raised p-4 @[42rem]:block`}>
                                        <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</h3>
                                        <pre className="mt-3 whitespace-pre-wrap font-serif text-base leading-7 text-ink">{translatedContent}</pre>
                                    </article>
                                </div>
                            </>
                            : <div className="mt-4 overflow-hidden rounded-panel border border-border bg-surface-raised">
                                <div className="grid gap-4 border-b border-border px-4 py-3 @[42rem]:grid-cols-2"><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationOriginal" })}</h3><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "views.translationResult" }, { language: targetLanguage })}</h3></div>
                                {Array.from({ length: paragraphCount }, (_, index) => <div className="grid gap-4 border-b border-border px-4 py-3 last:border-b-0 @[42rem]:grid-cols-2" key={index}>
                                    <pre className="whitespace-pre-wrap font-serif text-base leading-7 text-ink">{sourceParagraphs[index] ?? <span className="font-ui text-xs italic text-muted">{intl.formatMessage({ id: "views.translationMissingOriginal" })}</span>}</pre>
                                    <pre className="whitespace-pre-wrap font-serif text-base leading-7 text-ink">{translatedParagraphs[index] ?? <span className="font-ui text-xs italic text-muted">{intl.formatMessage({ id: "views.translationMissingResult" })}</span>}</pre>
                                </div>)}
                            </div>}
                    </div>
                    {translation?.metadata.protectedSpans.length ? <Banner className="mt-4" tone={protectedSpansValid ? "info" : "warning"} role={protectedSpansValid ? undefined : "alert"}>
                        <span>{intl.formatMessage({ id: protectedSpansValid ? "views.translationProtected" : "views.translationProtectedWarning" })}: {(protectedSpansValid ? translation.metadata.protectedSpans : protectedSpanWarnings).join(", ")}</span>
                    </Banner> : null}
                </>}
        </div>
        {translation && rejectConfirmationOpen && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl" open aria-labelledby="reject-translation-title" onCancel={(event) => {
            event.preventDefault();
            if (!rejecting)
                setRejectConfirmationOpen(false);
        }}>
            <h2 id="reject-translation-title" className="text-lg font-semibold">{intl.formatMessage({ id: "views.rejectTranslationTitle" })}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "views.rejectTranslationDescription" }, { language: translation.metadata.targetLanguage })}</p>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" disabled={rejecting} autoFocus onClick={() => setRejectConfirmationOpen(false)}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
                <Button variant="danger" state={rejecting ? "loading" : "default"} onClick={confirmRejection}>{intl.formatMessage({ id: "views.confirmRejectTranslation" })}</Button>
            </div>
        </Dialog>}
    </div>;
}
