import { type Article } from "@skladno/shared";
import { Banner, EmptyState, Tab, TabList } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { Translation } from "./translations-view-types.js";


interface TranslationBodyProps {
    source: Article;
    translatedContent?: string;
    targetLanguage: string;
    sourceParagraphs: string[];
    translatedParagraphs: string[];
    paragraphCount: number;
    translation?: Translation;
    protectedSpanWarnings: string[];
    protectedSpansValid: boolean;
    displayMode: "side-by-side" | "aligned";
    visibleText: "source" | "translation";
    setVisibleText: (text: "source" | "translation") => void;
}


export function TranslationBody({ source, translatedContent, targetLanguage, sourceParagraphs, translatedParagraphs, paragraphCount, translation, protectedSpanWarnings, protectedSpansValid, displayMode, visibleText, setVisibleText }: TranslationBodyProps) {
    const intl = useIntl();

    return <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
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
    </div>;
}
