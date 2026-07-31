import { publishLimitProfiles, type PublishLimitProfileId } from "@skladno/shared";
import { Banner, Select, TextareaField } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { publishingProfileMessageId } from "../../i18n/publishing.js";

export function PublishingPreviewView({ publishing }: {
    publishing: {
        text: string;
        count: number;
        profileId: PublishLimitProfileId;
        profile: { characterLimit: number };
        message: string;
        messageTone: "info" | "success" | "error";
        setProfile: (id: PublishLimitProfileId) => Promise<void>
    }
}) {
    const intl = useIntl();
    return <div>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.publishingPreview" })}</h2>
        <Select aria-label={intl.formatMessage({ id: "views.publishingProfile" })} value={publishing.profileId} onChange={(event) => void publishing.setProfile(event.target.value as PublishLimitProfileId)}>
            {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{intl.formatMessage({ id: publishingProfileMessageId(profile.id) })}</option>)}
        </Select>
        <p className="mt-3 text-sm">{intl.formatMessage({ id: "views.characterCount" }, { count: intl.formatNumber(publishing.count), limit: intl.formatNumber(publishing.profile.characterLimit) })}</p>
        <TextareaField aria-label={intl.formatMessage({ id: "views.plainTextPreview" })} className="mt-3 min-h-72" readOnly value={publishing.text} />
        {publishing.message && <Banner className="mt-2" tone={publishing.messageTone}>{publishing.message}</Banner>}
    </div>;
}
