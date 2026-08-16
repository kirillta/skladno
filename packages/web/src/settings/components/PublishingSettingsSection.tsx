import { articleLanguages, publishLimitProfiles, type GeneralSettings, type PublishLimitProfileId } from "@skladno/shared";
import { useIntl } from "react-intl";
import { publishingProfileMessageId } from "../../i18n/publishing.js";
import { Select } from "../../ui/primitives.js";
import { SettingRow } from "./SettingRow.js";


const languageMessageIds = {
    en: "languages.english",
    es: "languages.spanish",
    pt: "languages.portuguese",
    ru: "languages.russian",
    fr: "languages.french",
    de: "languages.german",
    it: "languages.italian",
} as const;


export function PublishingSettingsSection({ profileId, save, general, saveGeneral }: { profileId: PublishLimitProfileId; save: (profileId: PublishLimitProfileId) => void; general: GeneralSettings; saveGeneral: (next: GeneralSettings) => Promise<void> }) {
    const intl = useIntl();

    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.publishingProfile" })} hint={intl.formatMessage({ id: "settings.publishingProfileHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.publishingProfile" })} value={profileId} onChange={(event) => save(event.target.value as PublishLimitProfileId)}>
                {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>
                    {intl.formatMessage({ id: "settings.profileCharacters" }, { label: intl.formatMessage({ id: publishingProfileMessageId(profile.id) }), count: intl.formatNumber(profile.characterLimit) })}
                </option>)}
            </Select>
            <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "settings.publishingProfileNote" })}</p>
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} hint={intl.formatMessage({ id: "settings.defaultArticleLanguageHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} value={general.defaultArticleLanguage} onChange={(event) => void saveGeneral({ ...general, defaultArticleLanguage: event.target.value, defaultTranslationLanguages: general.defaultTranslationLanguages.filter((language) => language !== event.target.value) })}>
                {articleLanguages.map((language) => <option key={language} value={language}>{intl.formatMessage({ id: languageMessageIds[language] })}</option>)}
            </Select>
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} hint={intl.formatMessage({ id: "settings.defaultTranslationLanguagesHint" })}>
            <div role="group" aria-label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {articleLanguages.filter((language) => language !== general.defaultArticleLanguage).map((language) => <label key={language} className="flex min-h-8 items-center gap-2 text-sm text-ink">
                    <input className="size-4 accent-brand" type="checkbox" checked={general.defaultTranslationLanguages.includes(language)} onChange={(event) => void saveGeneral({ ...general, defaultTranslationLanguages: event.target.checked ? [...general.defaultTranslationLanguages, language] : general.defaultTranslationLanguages.filter((item) => item !== language) })} />
                    {intl.formatMessage({ id: languageMessageIds[language] })}
                </label>
                )}
            </div>
        </SettingRow>
    </>;
}
