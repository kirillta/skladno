import { useId, useRef } from "react";
import { useIntl } from "react-intl";
import { PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type CustomPublishLimitProfile, type PublishLimitProfile, type PublishLimitProfileId, type PublishingLength } from "@skladno/shared";
import { ChevronDownIcon, StatusIcon } from "../../ui/icons.js";
import { publishingProfileMessageId } from "../../i18n/publishing.js";
import { handleStatusMenuKeyDown, openStatusMenu } from "./ArticleStatusBarMenu.js";


export function PublishingProfileStatusControl({ length, profile, customProfiles, setProfile, open, onToggle, onOpen, onClose }: { length: PublishingLength; profile: PublishLimitProfile; customProfiles: readonly CustomPublishLimitProfile[]; setProfile: (id: PublishLimitProfileId) => Promise<void>; open: boolean; onToggle: () => void; onOpen: () => void; onClose: () => void }) {
    const intl = useIntl();
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();
    const profileOptions = [...publishLimitProfiles, ...customProfiles];
    const tone = length.state === "over-limit" ? "error" : length.state === "near-limit" ? "warning" : "info";


    async function selectProfile(profileId: PublishLimitProfileId) {
        await setProfile(profileId);
        onClose();
        trigger.current?.focus();
    }


    return <div className="relative ml-auto">
        <button ref={trigger} className={`inline-flex h-6 items-center gap-1 border-x border-border px-1.5 hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${tone === "error" ? "font-semibold text-danger" : tone === "warning" ? "font-semibold text-warning" : "text-muted"}`} type="button" aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" aria-label={intl.formatMessage({ id: "status.characterCount.ariaLabel" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit ?? 0) })} title={length.remaining === undefined ? undefined : length.state === "over-limit" ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(length.remaining)) }) : intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(length.remaining) })} onClick={onToggle} onKeyDown={(event) => {
            if (event.key === "Escape")
                onClose();

            openStatusMenu(event, onOpen, menuId);
        }}>
            {tone !== "info" && <StatusIcon tone={tone} className="size-3 shrink-0" />}
            <span>{profile.characterLimit === undefined ? intl.formatMessage({ id: "publishing.characterCount" }, { count: intl.formatNumber(length.count) }) : intl.formatMessage({ id: "status.characterCount" }, { characterCount: intl.formatNumber(length.count), characterLimit: intl.formatNumber(profile.characterLimit) })}</span>
            <ChevronDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div id={menuId} className="absolute bottom-6 right-0 z-10 w-56 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "status.characterLimitPresets" })} onKeyDown={(event) => handleStatusMenuKeyDown(event, () => {
            onClose();
            trigger.current?.focus();
        })}>
            {profileOptions.map((preset) => <button key={preset.id} className="flex min-h-9 w-full items-center justify-between rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitemradio" aria-checked={preset.id === profile.id} onClick={() => void selectProfile(preset.id)}>
                <span>{"name" in preset ? preset.name : preset.id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS ? intl.formatMessage({ id: "publishing.noRestrictions" }) : intl.formatMessage({ id: publishingProfileMessageId(preset.id) })}</span>
                {preset.characterLimit !== undefined && <span className="text-muted">{intl.formatNumber(preset.characterLimit)}</span>}
            </button>)}
        </div>}
    </div>;
}
