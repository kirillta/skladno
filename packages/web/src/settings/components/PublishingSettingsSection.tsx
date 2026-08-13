import { publishLimitProfiles, type PublishLimitProfileId } from "@skladno/shared";
import { useIntl } from "react-intl";
import { publishingProfileMessageId } from "../../i18n/publishing.js";
import { Select } from "../../ui/primitives.js";
import { SettingRow } from "./SettingRow.js";


export function PublishingSettingsSection({ profileId, save }: { profileId: PublishLimitProfileId; save: (profileId: PublishLimitProfileId) => void }) {
    const intl = useIntl();

    return <SettingRow label={intl.formatMessage({ id: "settings.publishingProfile" })} hint={intl.formatMessage({ id: "settings.publishingProfileHint" })}>
        <Select value={profileId} onChange={(event) => save(event.target.value as PublishLimitProfileId)}>
            {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>
                {intl.formatMessage({ id: "settings.profileCharacters" }, { label: intl.formatMessage({ id: publishingProfileMessageId(profile.id) }), count: intl.formatNumber(profile.characterLimit) })}
            </option>)}
        </Select>
        <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "settings.publishingProfileNote" })}</p>
    </SettingRow>;
}
