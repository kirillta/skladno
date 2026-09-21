import { getPublishingLength, type Article, type PublishLimitProfile } from "@skladno/shared";
import { AlignedParagraphsIcon, SideBySideIcon } from "../../ui/icons.js";
import { Button, IconButton } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { Translation } from "./translations-view-types.js";


interface TranslationsHeaderProps {
    sourceArticle?: Article;
    translation?: Translation;
    translationLanguages: readonly string[];
    translatedContent?: string;
    publishingGuidance?: { length: ReturnType<typeof getPublishingLength>; profile: PublishLimitProfile };
    protectedSpansValid: boolean;
    displayMode: "side-by-side" | "aligned";
    creating: boolean;
    rejecting: boolean;
    stale: boolean;
    edit?: () => void;
    reject?: (targetLanguage: string) => Promise<void>;
    translate: () => void;
    startCreate: () => void;
    setDisplayMode: (mode: "side-by-side" | "aligned") => void;
    setRejectionLanguage: (language: string) => void;
    setRejectConfirmationOpen: (open: boolean) => void;
}


export function TranslationsHeader({ sourceArticle, translation, translationLanguages, translatedContent, publishingGuidance, protectedSpansValid, displayMode, creating, rejecting, stale, edit, reject, translate, startCreate, setDisplayMode, setRejectionLanguage, setRejectConfirmationOpen }: TranslationsHeaderProps) {
    const intl = useIntl();

    return <header className="shrink-0">
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
                {translation?.editorialArtifactId && reject && <Button variant="danger" disabled={creating || rejecting} onClick={() => {
                    setRejectionLanguage(translation.metadata.targetLanguage);
                    setRejectConfirmationOpen(true);
                }}>{intl.formatMessage({ id: "views.rejectTranslation" })}</Button>}
                <Button disabled={!translationLanguages.length} onClick={translate}>{intl.formatMessage({ id: "views.translate" })}</Button>
            </div>
        </div>
    </header>;
}
