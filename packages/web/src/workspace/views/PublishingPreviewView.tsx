import { useState } from "react";
import { Button, Select, TextareaField } from "../../ui/primitives.js";
import { PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type PublishLimitProfileId } from "@skladno/shared";
import { useIntl } from "react-intl";


export function PublishingPreviewView({ publishing }: {
    publishing: {
        text: string;
        profileId: PublishLimitProfileId;
        profile: { characterLimit?: number };
        settings: { customProfile: { name: string } };
        length: { count: number; remaining?: number; state: "within-limit" | "near-limit" | "over-limit" };
        setProfile: (id: PublishLimitProfileId) => Promise<void>;
        copy: () => Promise<void>;
    }
}) {
    const intl = useIntl();
    const [copying, setCopying] = useState(false);
    const copy = () => {
        setCopying(true);
        void publishing.copy().then(() => setCopying(false), () => setCopying(false));
    };
    const label = (id: PublishLimitProfileId) => id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS ? intl.formatMessage({ id: "publishing.noRestrictions" }) : id === PUBLISH_LIMIT_PROFILE.CUSTOM ? publishing.settings.customProfile.name : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_POST ? intl.formatMessage({ id: "publishing.linkedInPost" }) : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_ARTICLE ? intl.formatMessage({ id: "publishing.linkedInArticle" }) : intl.formatMessage({ id: "publishing.default" });
    return <div className="mx-auto w-full max-w-3xl p-5">
        <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.publishingPreview" })}</h2>
        <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "publishing.explicitCopy" })}</p>
        <Select className="mt-3" aria-label={intl.formatMessage({ id: "settings.publishingProfile" })} value={publishing.profileId} onChange={(event) => void publishing.setProfile(event.target.value as PublishLimitProfileId)}>
            {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{label(profile.id)}</option>)}
        </Select>
        <p className={publishing.length.state === "over-limit" ? "mt-2 text-xs text-danger" : publishing.length.state === "near-limit" ? "mt-2 text-xs text-warning" : "mt-2 text-xs text-muted"}>{publishing.profile.characterLimit === undefined ? intl.formatMessage({ id: "publishing.characterCount" }, { count: intl.formatNumber(publishing.length.count) }) : publishing.length.state === "over-limit" ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(publishing.length.remaining ?? 0)) }) : intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(publishing.length.remaining ?? 0) })}</p>
        <TextareaField aria-label={intl.formatMessage({ id: "views.plainTextPreview" })} className="mt-3 min-h-72" readOnly value={publishing.text} />
        <Button className="mt-3" variant="secondary" state={copying ? "loading" : "default"} onClick={copy}>{intl.formatMessage({ id: "views.copyPlainText" })}</Button>
    </div>;
}
