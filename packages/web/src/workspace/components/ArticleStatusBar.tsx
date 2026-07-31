import { useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { publishLimitProfiles, type PublishLimitProfile, type PublishLimitProfileId } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { publishingProfileMessageId } from "../../i18n/publishing.js";

export function ArticleStatusBar(props: {
    revisionNumber: number;
    characterCount: number;
    profile: PublishLimitProfile;
    setProfile: (id: PublishLimitProfileId) => Promise<void>;
}) {
    return <IntlProvider locale="en" messages={messages}><LocalizedArticleStatusBar {...props} /></IntlProvider>;
}

function LocalizedArticleStatusBar({ revisionNumber, characterCount, profile, setProfile }: {
    revisionNumber: number;
    characterCount: number;
    profile: PublishLimitProfile;
    setProfile: (id: PublishLimitProfileId) => Promise<void>;
}) {
    const intl = useIntl();
    const [limitMenuOpen, setLimitMenuOpen] = useState(false);

    async function selectProfile(profileId: PublishLimitProfileId) {
        await setProfile(profileId);
        setLimitMenuOpen(false);
    }

    return <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border px-5 text-xs text-muted" aria-label={intl.formatMessage({ id: "status.article" })}>
        <span>{intl.formatMessage({ id: "status.revision" }, { revisionNumber })}</span>
        <div className="relative">
            <button
                className="inline-flex h-6 items-center gap-1 rounded-control px-1.5 font-semibold hover:bg-brand-soft hover:text-brand focus:outline-none"
                type="button"
                aria-expanded={limitMenuOpen}
                aria-haspopup="menu"
                aria-label={intl.formatMessage({ id: "status.characterCount.ariaLabel" }, { characterCount: intl.formatNumber(characterCount), characterLimit: intl.formatNumber(profile.characterLimit) })}
                onClick={() => setLimitMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                    if (event.key === "Escape")
                        setLimitMenuOpen(false);
                }}
            >
                <span>{intl.formatMessage({ id: "status.characterCount" }, { characterCount: intl.formatNumber(characterCount), characterLimit: intl.formatNumber(profile.characterLimit) })}</span>
                <svg aria-hidden="true" className={`size-3 transition-transform ${limitMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>
            {limitMenuOpen && <div className="absolute bottom-6 right-0 z-10 w-56 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "status.characterLimitPresets" })}>
                {publishLimitProfiles.map((preset) => <button
                    key={preset.id}
                    className="flex min-h-9 w-full items-center justify-between rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none"
                    type="button"
                    role="menuitemradio"
                    aria-checked={preset.id === profile.id}
                    onClick={() => void selectProfile(preset.id)}
                >
                    <span>{intl.formatMessage({ id: publishingProfileMessageId(preset.id) })}</span>
                    <span className="text-muted">{intl.formatNumber(preset.characterLimit)}</span>
                </button>)}
            </div>}
        </div>
    </footer>;
}
