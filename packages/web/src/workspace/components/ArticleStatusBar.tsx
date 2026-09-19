import { useState, type KeyboardEvent } from "react";
import { useIntl } from "react-intl";
import type { ArticleRevision, CustomPublishLimitProfile, PublishLimitProfile, PublishLimitProfileId, PublishingLength } from "@skladno/shared";
import type { DraftPresentationState as SaveState } from "../drafts/draft-lifecycle.js";
import { CopyStatusControl } from "./CopyStatusControl.js";
import { LanguageStatusControl } from "./LanguageStatusControl.js";
import { PublishingProfileStatusControl } from "./PublishingProfileStatusControl.js";
import { RevisionStatusControl } from "./RevisionStatusControl.js";
import { SaveStatus } from "./SaveStatus.js";


export interface RevisionSelector {
    revisions: readonly ArticleRevision[];
    currentRevisionId: string;
    selectForRestore: (revision: ArticleRevision) => void;
}


export interface ArticleStatusBarProps {
    revisionNumber: number;
    revisionSelector?: RevisionSelector;
    language: string;
    setLanguage: (language: string) => Promise<void>;
    saveState: SaveState;
    length: PublishingLength;
    profile: PublishLimitProfile;
    customProfiles: readonly CustomPublishLimitProfile[];
    setProfile: (id: PublishLimitProfileId) => Promise<void>;
    copyMarkdown: () => Promise<boolean>;
    copyPlainText: () => Promise<boolean>;
}


type StatusMenu = "revision" | "language" | "profile" | "copy";


export function ArticleStatusBar(props: ArticleStatusBarProps) {
    return <LocalizedArticleStatusBar {...props} />;
}


function LocalizedArticleStatusBar({ revisionNumber, revisionSelector, language, setLanguage, saveState, length, profile, customProfiles, setProfile, copyMarkdown, copyPlainText }: ArticleStatusBarProps) {
    const intl = useIntl();
    const [openMenu, setOpenMenu] = useState<StatusMenu | null>(null);


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


    function toggleMenu(menu: StatusMenu) {
        setOpenMenu((current) => current === menu ? null : menu);
    }


    return <footer data-focus-area="article-status" onKeyDown={handleStatusKeyDown} className="flex h-6 shrink-0 items-center border-t border-border px-5 text-xs text-muted" aria-label={intl.formatMessage({ id: "status.article" })}>
        <RevisionStatusControl revisionNumber={revisionNumber} revisionSelector={revisionSelector} open={openMenu === "revision"} onToggle={() => toggleMenu("revision")} onOpen={() => setOpenMenu("revision")} onClose={() => setOpenMenu(null)} />
        <LanguageStatusControl language={language} setLanguage={setLanguage} open={openMenu === "language"} onToggle={() => toggleMenu("language")} onOpen={() => setOpenMenu("language")} onClose={() => setOpenMenu(null)} />
        <SaveStatus saveState={saveState} />
        <PublishingProfileStatusControl length={length} profile={profile} customProfiles={customProfiles} setProfile={setProfile} open={openMenu === "profile"} onToggle={() => toggleMenu("profile")} onOpen={() => setOpenMenu("profile")} onClose={() => setOpenMenu(null)} />
        <CopyStatusControl copyMarkdown={copyMarkdown} copyPlainText={copyPlainText} open={openMenu === "copy"} onToggle={() => toggleMenu("copy")} onOpen={() => setOpenMenu("copy")} onClose={() => setOpenMenu(null)} />
    </footer>;
}
