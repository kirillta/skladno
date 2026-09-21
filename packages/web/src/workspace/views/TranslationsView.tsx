import { useState } from "react";
import { getPublishingLength } from "@skladno/shared";
import { TranslationsHeader } from "./TranslationsHeader.js";
import { TranslationsNavigation } from "./TranslationsNavigation.js";
import { TranslationBody } from "./TranslationBody.js";
import { TranslationRejectionDialog } from "./TranslationRejectionDialog.js";
import type { TranslationsActions } from "./translations-view-actions.js";
import type { TranslationsData } from "./translations-view-data.js";
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


export function TranslationsView({ data, actions }: { data: TranslationsData; actions: TranslationsActions }) {
    const { article, sourceArticle, linkedTranslations = [], translations = [], stale, translationLanguages = [], publishProfile, selectedTargetLanguage } = data;
    const { create, reject, edit, openArticle, selectTargetLanguage, translate } = actions;
    const [creating, setCreating] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectConfirmationOpen, setRejectConfirmationOpen] = useState(false);
    const [rejectionComplete, setRejectionComplete] = useState(false);
    const [rejectionLanguage, setRejectionLanguage] = useState<string>();
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
            setRejectionComplete(true);
            window.setTimeout(() => {
                setRejectConfirmationOpen(false);
                setRejectionComplete(false);
                setRejectionLanguage(undefined);
            }, 300);
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
        <TranslationsHeader
            sourceArticle={sourceArticle}
            translation={translation}
            translationLanguages={translationLanguages}
            translatedContent={translatedContent}
            publishingGuidance={publishingGuidance}
            protectedSpansValid={protectedSpansValid}
            displayMode={displayMode}
            creating={creating}
            rejecting={rejecting}
            stale={stale}
            edit={edit}
            reject={reject}
            translate={translate}
            startCreate={startCreate}
            setDisplayMode={setDisplayMode}
            setRejectionLanguage={setRejectionLanguage}
            setRejectConfirmationOpen={setRejectConfirmationOpen}
        />
        <TranslationsNavigation
            article={article}
            sourceArticle={sourceArticle}
            linkedTranslations={linkedTranslations}
            translations={translations}
            translation={translation}
            stale={stale}
            openArticle={openArticle}
            selectTargetLanguage={selectTargetLanguage}
        />
        <TranslationBody
            source={source}
            translatedContent={translatedContent}
            targetLanguage={targetLanguage}
            sourceParagraphs={sourceParagraphs}
            translatedParagraphs={translatedParagraphs}
            paragraphCount={paragraphCount}
            translation={translation}
            protectedSpanWarnings={protectedSpanWarnings}
            protectedSpansValid={protectedSpansValid}
            displayMode={displayMode}
            visibleText={visibleText}
            setVisibleText={setVisibleText}
        />
        <TranslationRejectionDialog
            rejectionLanguage={rejectionLanguage}
            rejectionComplete={rejectionComplete}
            rejectionConfirmationOpen={rejectConfirmationOpen}
            rejecting={rejecting}
            setRejectConfirmationOpen={setRejectConfirmationOpen}
            confirmRejection={confirmRejection}
        />
    </div>;
}
