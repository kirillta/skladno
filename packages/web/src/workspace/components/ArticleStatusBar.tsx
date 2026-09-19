import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useIntl } from "react-intl";
import { articleLanguages, PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type ArticleRevision, type CustomPublishLimitProfile, type PublishLimitProfile, type PublishLimitProfileId, type PublishingLength } from "@skladno/shared";
import { ChevronDownIcon, CopyIcon, StatusIcon, SuccessIcon } from "../../ui/icons.js";
import { Button } from "../../ui/primitives.js";
import { publishingProfileMessageId } from "../../i18n/publishing.js";
import type { DraftPresentationState as SaveState } from "../drafts/draft-lifecycle.js";
import { RevisionArticlePreview } from "../editor/RevisionArticlePreview.js";
import { getProvenanceMessageId } from "../views/revision-history-presentation.js";


interface RevisionSelector {
    revisions: readonly ArticleRevision[];
    currentRevisionId: string;
    selectForRestore: (revision: ArticleRevision) => void;
}


export function ArticleStatusBar(props: { revisionNumber: number; revisionSelector?: RevisionSelector; language: string; setLanguage: (language: string) => Promise<void>; saveState: SaveState; length: PublishingLength; profile: PublishLimitProfile; customProfiles: readonly CustomPublishLimitProfile[]; setProfile: (id: PublishLimitProfileId) => Promise<void>; copyMarkdown: () => Promise<boolean>; copyPlainText: () => Promise<boolean> }) {
    return <LocalizedArticleStatusBar {...props} />;
}


function LocalizedArticleStatusBar({ revisionNumber, revisionSelector, language, setLanguage, saveState, length, profile, customProfiles, setProfile, copyMarkdown, copyPlainText }: Parameters<typeof ArticleStatusBar>[0]) {
    const intl = useIntl();
    const [revisionMenuOpen, setRevisionMenuOpen] = useState(false);
    const [selectedRevisionId, setSelectedRevisionId] = useState(revisionSelector?.currentRevisionId);
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [copyMenuOpen, setCopyMenuOpen] = useState(false);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const copyTimer = useRef<ReturnType<typeof setTimeout>>();
    const revisionTrigger = useRef<HTMLButtonElement>(null);
    const languageTrigger = useRef<HTMLButtonElement>(null);
    const profileTrigger = useRef<HTMLButtonElement>(null);
    const copyTrigger = useRef<HTMLButtonElement>(null);
    const revisionMenuId = useId();
    const languageMenuId = useId();
    const profileMenuId = useId();
    const copyMenuId = useId();
    const availableRevisions = revisionSelector?.revisions ?? [];
    const selectedRevision = availableRevisions.find((revision) => revision.id === selectedRevisionId)
        ?? availableRevisions.find((revision) => revision.id === revisionSelector?.currentRevisionId);
    const selectedRevisionNumber = selectedRevision ? availableRevisions.indexOf(selectedRevision) + 1 : revisionNumber;
    const tone = length.state === "over-limit" ? "error" : length.state === "near-limit" ? "warning" : "info";
    const profileOptions = [...publishLimitProfiles, ...customProfiles];
    const saveLabels: Record<SaveState, string> = {
        saved: intl.formatMessage({ id: "navigation.saved" }),
        unsaved: intl.formatMessage({ id: "navigation.unsaved" }),
        saving: intl.formatMessage({ id: "navigation.savingDraft" }),
        "draft-saved": intl.formatMessage({ id: "navigation.draftSaved" }),
        error: intl.formatMessage({ id: "navigation.saveFailed" }),
        conflict: intl.formatMessage({ id: "navigation.saveConflict" }),
    };
    const saveLabel = saveLabels[saveState];
    const saveTone = saveState === "saved" || saveState === "draft-saved" ? "text-success" : saveState === "unsaved" || saveState === "saving" ? "text-warning" : "text-danger";


    useEffect(() => {
        setSelectedRevisionId(revisionSelector?.currentRevisionId);
    }, [revisionSelector?.currentRevisionId]);


    async function selectProfile(profileId: PublishLimitProfileId) {
        await setProfile(profileId);
        setProfileMenuOpen(false);
        profileTrigger.current?.focus();
    }


    async function selectLanguage(nextLanguage: string) {
        await setLanguage(nextLanguage);
        setLanguageMenuOpen(false);
        languageTrigger.current?.focus();
    }


    function selectRevision(revision: ArticleRevision) {
        setSelectedRevisionId(revision.id);
    }


    useEffect(() => () => clearTimeout(copyTimer.current), []);


    function openMenu(event: KeyboardEvent<HTMLButtonElement>, setOpen: (open: boolean) => void, closeOthers: () => void, menuId: string) {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
            return;

        event.preventDefault();
        setOpen(true);
        closeOthers();
        requestAnimationFrame(() => {
            const items = document.getElementById(menuId)?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]");
            items?.[event.key === "ArrowDown" ? 0 : items.length - 1]?.focus();
        });
    }


    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>, close: () => void) {
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role^=menuitem]")];
        const index = document.activeElement instanceof HTMLButtonElement ? items.indexOf(document.activeElement) : -1;
        const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : undefined;

        if (event.key === "Escape") {
            event.preventDefault();
            close();
        } else if (next !== undefined) {
            event.preventDefault();
            items[(next + items.length) % items.length]?.focus();
        }
    }


    function handleStatusKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
            return;

        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([role^=menuitem])")];
        const index = controls.indexOf(document.activeElement as HTMLButtonElement);
        if (index < 0)
            return;

        event.preventDefault();
        controls[(index + (event.key === "ArrowRight" ? 1 : controls.length - 1)) % controls.length]?.focus();
    }


    function copy(copyText: () => Promise<boolean>) {
        void copyText().then((copied) => {
            setCopyStatus(copied ? "copied" : "failed");
            setCopyMenuOpen(false);
            copyTrigger.current?.focus();
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopyStatus("idle"), 1200);
        });
    }


    return <footer data-focus-area="article-status" onKeyDown={handleStatusKeyDown} className="flex h-6 shrink-0 items-center border-t border-border px-5 text-xs text-muted" aria-label={intl.formatMessage({ id: "status.article" })}>
        {revisionSelector
            ? <div className="relative shrink-0">
                <button data-focus-area-entry ref={revisionTrigger} className="inline-flex h-6 items-center gap-1 rounded-control px-1.5 text-xs text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" aria-label={intl.formatMessage({ id: "status.revisionSelector" }, { revisionNumber })} aria-controls={revisionMenuOpen ? revisionMenuId : undefined} aria-expanded={revisionMenuOpen} aria-haspopup="menu" onClick={() => {
                    setRevisionMenuOpen((open) => !open);
                    setLanguageMenuOpen(false);
                    setProfileMenuOpen(false);
                    setCopyMenuOpen(false);
                }} onKeyDown={(event) => {
                    if (event.key === "Escape")
                        setRevisionMenuOpen(false);

                    openMenu(event, setRevisionMenuOpen, () => {
                        setLanguageMenuOpen(false);
                        setProfileMenuOpen(false);
                        setCopyMenuOpen(false);
                    }, revisionMenuId);
                }}>
                    <span>{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>
                    <ChevronDownIcon className={`size-3 transition-transform ${revisionMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {revisionMenuOpen && <div className="absolute bottom-6 left-0 z-20 w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface-raised p-1 shadow-raised">
                    <div id={revisionMenuId} role="menu" aria-label={intl.formatMessage({ id: "status.revisionMenu" })} onKeyDown={(event) => handleMenuKeyDown(event, () => {
                        setRevisionMenuOpen(false);
                        revisionTrigger.current?.focus();
                    })}>
                        {[...availableRevisions].reverse().map((revision) => {
                            const itemRevisionNumber = availableRevisions.indexOf(revision) + 1;
                            const current = revision.id === revisionSelector.currentRevisionId;
                            const selected = revision.id === selectedRevision?.id;

                            return <button key={revision.id} className={`flex min-h-9 w-full items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "bg-brand-soft" : ""}`} type="button" role="menuitemradio" aria-checked={selected} aria-label={[intl.formatMessage({ id: "revisions.revision" }), intl.formatNumber(itemRevisionNumber), intl.formatMessage({ id: getProvenanceMessageId(revision) }), current ? intl.formatMessage({ id: "revisions.current" }) : undefined, selected ? intl.formatMessage({ id: "status.revisionSelected" }) : undefined].filter(Boolean).join(", ")} onClick={() => selectRevision(revision)}>
                                <span className="font-semibold">{intl.formatMessage({ id: "status.revision" }, { revisionNumber: itemRevisionNumber })}</span>
                                <span className="min-w-0 flex-1 truncate">{intl.formatMessage({ id: getProvenanceMessageId(revision) })}</span>
                                {current && <span className="text-micro font-semibold text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>}
                                {selected && <span className="text-micro font-semibold text-brand">{intl.formatMessage({ id: "status.revisionSelected" })}</span>}
                            </button>;
                        })}
                    </div>
                    {selectedRevision && <section className="mt-1 border-t border-border px-2 pb-2 pt-3" aria-label={intl.formatMessage({ id: "status.revisionPreview" }, { revisionNumber: selectedRevisionNumber })}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-ink">{intl.formatMessage({ id: "status.revision" }, { revisionNumber: selectedRevisionNumber })}</span>
                            {selectedRevision.id === revisionSelector.currentRevisionId && <span className="text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>}
                        </div>
                        <div className="mt-2 max-h-[50dvh] overflow-y-auto rounded-control border border-border bg-editor-surface p-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
                            <RevisionArticlePreview revisionId={selectedRevision.id} content={selectedRevision.content} />
                        </div>
                        {selectedRevision.id !== revisionSelector.currentRevisionId && <Button compact variant="secondary" className="mt-2" onClick={() => {
                            revisionSelector.selectForRestore(selectedRevision);
                            setRevisionMenuOpen(false);
                            revisionTrigger.current?.focus();
                        }}>{intl.formatMessage({ id: "revisions.restore" })}</Button>}
                    </section>}
                </div>}
            </div>
            : <span className="font-normal text-muted">{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>}
        <div className="relative ml-2 shrink-0">
            <button data-focus-area-entry ref={languageTrigger} className="inline-flex h-6 items-center gap-1 border-x border-border px-1.5 text-xs text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" aria-label={intl.formatMessage({ id: "articleHeader.sourceLanguage" })} aria-controls={languageMenuOpen ? languageMenuId : undefined} aria-expanded={languageMenuOpen} aria-haspopup="menu" onClick={() => {
                setLanguageMenuOpen((open) => !open);
                setProfileMenuOpen(false);
                setCopyMenuOpen(false);
            }} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setLanguageMenuOpen(false);

                openMenu(event, setLanguageMenuOpen, () => {
                    setProfileMenuOpen(false);
                    setCopyMenuOpen(false);
                }, languageMenuId);
            }}>
                <span>{intl.formatMessage({ id: getLanguageMessageId(language) })}</span>
                <ChevronDownIcon className={`size-3 transition-transform ${languageMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {languageMenuOpen && <div id={languageMenuId} className="absolute bottom-6 left-0 z-10 w-40 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "articleHeader.sourceLanguage" })} onKeyDown={(event) => handleMenuKeyDown(event, () => {
                setLanguageMenuOpen(false);
                languageTrigger.current?.focus();
            })}>
                {articleLanguages.map((option) => <button key={option} className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitemradio" aria-checked={option === language} onClick={() => void selectLanguage(option)}>{intl.formatMessage({ id: getLanguageMessageId(option) })}</button>)}
            </div>}
        </div>
        <span aria-label={saveLabel} className={`ml-2 inline-flex items-center gap-1 text-xs ${saveTone}`} role="status" title={saveLabel}>
            <span aria-hidden="true">&#9679;</span>
            {saveLabel}
        </span>
        <div className="relative ml-auto">
            <button ref={profileTrigger} className={`inline-flex h-6 items-center gap-1 rounded-control px-1.5 hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${tone === "error" ? "font-semibold text-danger" : tone === "warning" ? "font-semibold text-warning" : "text-muted"}`} type="button" aria-controls={profileMenuOpen ? profileMenuId : undefined} aria-expanded={profileMenuOpen} aria-haspopup="menu" aria-label={intl.formatMessage({ id: "status.characterCount.ariaLabel" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit ?? 0) })} title={length.remaining === undefined ? undefined : length.state === "over-limit" ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(length.remaining)) }) : intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(length.remaining) })} onClick={() => {
                setProfileMenuOpen((open) => !open);
                setLanguageMenuOpen(false);
            }} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setProfileMenuOpen(false);

                openMenu(event, setProfileMenuOpen, () => {
                    setLanguageMenuOpen(false);
                    setCopyMenuOpen(false);
                }, profileMenuId);
            }}>
                {tone !== "info" && <StatusIcon tone={tone} className="size-3 shrink-0" />}
                <span>{profile.characterLimit === undefined ? intl.formatMessage({ id: "publishing.characterCount" }, { count: intl.formatNumber(length.count) }) : intl.formatMessage({ id: "status.characterCount" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit) })}</span>
                <ChevronDownIcon className={`size-3 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {profileMenuOpen && <div id={profileMenuId} className="absolute bottom-6 right-0 z-10 w-56 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "status.characterLimitPresets" })} onKeyDown={(event) => handleMenuKeyDown(event, () => {
                setProfileMenuOpen(false);
                profileTrigger.current?.focus();
            })}>
                {profileOptions.map((preset) => <button key={preset.id} className="flex min-h-9 w-full items-center justify-between rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitemradio" aria-checked={preset.id === profile.id} onClick={() => void selectProfile(preset.id)}>
                    <span>{"name" in preset ? preset.name : preset.id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS ? intl.formatMessage({ id: "publishing.noRestrictions" }) : intl.formatMessage({ id: publishingProfileMessageId(preset.id) })}</span>
                    {preset.characterLimit !== undefined && <span className="text-muted">{intl.formatNumber(preset.characterLimit)}</span>}
                </button>)}
            </div>}
        </div>
        <div className="relative ml-2 flex items-center border-l border-border pl-2">
            <button className={`inline-flex h-6 items-center gap-1 px-1.5 transition-colors hover:bg-brand-soft hover:text-brand ${copyStatus === "failed" ? "text-danger" : "text-muted"}`} type="button" aria-live="polite" onClick={() => copy(copyMarkdown)}>
                {copyStatus === "copied" ? <SuccessIcon className="size-3 motion-safe:animate-pulse" /> : <CopyIcon className="size-3" />}
                <span>{intl.formatMessage({ id: copyStatus === "copied" ? "articleHeader.copied" : copyStatus === "failed" ? "articleHeader.copyFailed" : "articleHeader.copy" })}</span>
            </button>
            <button ref={copyTrigger} className="grid size-6 place-items-center text-muted transition-colors hover:bg-brand-soft hover:text-brand" type="button" aria-label={intl.formatMessage({ id: "articleHeader.copyOptions" })} aria-controls={copyMenuOpen ? copyMenuId : undefined} aria-expanded={copyMenuOpen} aria-haspopup="menu" onClick={() => {
                setCopyMenuOpen((open) => !open);
                setLanguageMenuOpen(false);
                setProfileMenuOpen(false);
            }} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setCopyMenuOpen(false);

                openMenu(event, setCopyMenuOpen, () => {
                    setLanguageMenuOpen(false);
                    setProfileMenuOpen(false);
                }, copyMenuId);
            }}>
                <ChevronDownIcon className={`size-3 transition-transform ${copyMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {copyMenuOpen && <div id={copyMenuId} className="absolute bottom-6 right-0 z-10 w-40 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "articleHeader.copyOptions" })} onKeyDown={(event) => handleMenuKeyDown(event, () => {
                setCopyMenuOpen(false);
                copyTrigger.current?.focus();
            })}>
                <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => copy(copyMarkdown)}>{intl.formatMessage({ id: "articleHeader.copyMarkdown" })}</button>
                <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => copy(copyPlainText)}>{intl.formatMessage({ id: "articleHeader.copyPlainText" })}</button>
            </div>}
        </div>
    </footer>;
}


function getLanguageMessageId(language: string): "languages.english" | "languages.spanish" | "languages.portuguese" | "languages.russian" | "languages.french" | "languages.german" | "languages.italian" {
    return ({
        en: "languages.english",
        es: "languages.spanish",
        pt: "languages.portuguese",
        ru: "languages.russian",
        fr: "languages.french",
        de: "languages.german",
        it: "languages.italian"
    } as const)[language as "en" | "es" | "pt" | "ru" | "fr" | "de" | "it"];
}
