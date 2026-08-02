import { useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { publishLimitProfiles, type PublishLimitProfile, type PublishLimitProfileId, type PublishingLength } from "@skladno/shared";
import { ChevronDownIcon, StatusIcon } from "../../ui/icons.js";
import { messages } from "../../i18n/messages.js";
import { publishingProfileMessageId } from "../../i18n/publishing.js";


export function ArticleStatusBar(props: { revisionNumber: number; length: PublishingLength; profile: PublishLimitProfile; setProfile: (id: PublishLimitProfileId) => Promise<void> }) {
    return <IntlProvider locale="en" messages={messages}><LocalizedArticleStatusBar {...props} /></IntlProvider>;
}


function LocalizedArticleStatusBar({ revisionNumber, length, profile, setProfile }: { revisionNumber: number; length: PublishingLength; profile: PublishLimitProfile; setProfile: (id: PublishLimitProfileId) => Promise<void> }) {
    const intl = useIntl();
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const tone = length.state === "over-limit" ? "error" : length.state === "near-limit" ? "warning" : "info";

    async function selectProfile(profileId: PublishLimitProfileId) {
        await setProfile(profileId);
        setProfileMenuOpen(false);
    }

    return <footer className="flex h-6 shrink-0 items-center border-t border-border px-5 text-xs text-muted" aria-label={intl.formatMessage({ id: "status.article" })}>
        <span className="font-normal text-muted">{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>
        <div className="relative ml-auto">
            <button className={`inline-flex h-6 items-center gap-1 rounded-control px-1.5 hover:bg-brand-soft hover:text-brand focus:outline-none ${tone === "error" ? "font-semibold text-danger" : tone === "warning" ? "font-semibold text-warning" : "text-muted"}`} type="button" aria-expanded={profileMenuOpen} aria-haspopup="menu" aria-label={intl.formatMessage({ id: "status.characterCount.ariaLabel" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit) })} title={length.state === "over-limit" ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(length.remaining)) }) : length.state === "near-limit" ? intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(length.remaining) }) : undefined} onClick={() => setProfileMenuOpen((open) => !open)} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setProfileMenuOpen(false);
            }}>
                {tone !== "info" && <StatusIcon tone={tone} className="size-3 shrink-0" />}
                <span>{intl.formatMessage({ id: "status.characterCount" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit) })}</span>
                <ChevronDownIcon className={`size-3 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {profileMenuOpen && <div className="absolute bottom-6 right-0 z-10 w-56 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "status.characterLimitPresets" })}>
                {publishLimitProfiles.map((preset) => <button key={preset.id} className="flex min-h-9 w-full items-center justify-between rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitemradio" aria-checked={preset.id === profile.id} onClick={() => void selectProfile(preset.id)}>
                    <span>{intl.formatMessage({ id: publishingProfileMessageId(preset.id) })}</span>
                    <span className="text-muted">{intl.formatNumber(preset.characterLimit)}</span>
                </button>)}
            </div>}
        </div>
    </footer>;
}
