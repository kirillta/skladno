import { articleLanguages, PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type GeneralSettings, type PublishingSettings } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Field, Select } from "../../ui/primitives.js";
import { SettingRow } from "./SettingRow.js";

const languageMessageIds = { en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian" } as const;


export function PublishingSettingsSection({ publishing, save, general, saveGeneral }: { publishing: PublishingSettings; save: (next: PublishingSettings) => void; general: GeneralSettings; saveGeneral: (next: GeneralSettings) => Promise<void> }) {
    const intl = useIntl();
    const profileLabel = (id: string) => id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS ? intl.formatMessage({ id: "publishing.noRestrictions" }) : id === PUBLISH_LIMIT_PROFILE.CUSTOM ? publishing.customProfile.name : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_POST ? intl.formatMessage({ id: "publishing.linkedInPost" }) : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_ARTICLE ? intl.formatMessage({ id: "publishing.linkedInArticle" }) : intl.formatMessage({ id: "publishing.default" });
    const updateCustom = (next: Partial<PublishingSettings["customProfile"]>) => save({ ...publishing, customProfile: { ...publishing.customProfile, ...next } });

    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.publishingProfile" })} hint={intl.formatMessage({ id: "settings.publishingProfileHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.publishingProfile" })} value={publishing.defaultProfileId} onChange={(event) => save({ ...publishing, defaultProfileId: event.target.value as PublishingSettings["defaultProfileId"] })}>
                {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profileLabel(profile.id)}{profile.characterLimit === undefined ? "" : ` (${intl.formatNumber(profile.characterLimit)})`}</option>)}
            </Select>
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.customProfileName" })} hint={intl.formatMessage({ id: "settings.customProfileNameHint" })}>
            <Field aria-label={intl.formatMessage({ id: "settings.customProfileName" })} value={publishing.customProfile.name} onChange={(event) => updateCustom({ name: event.target.value })} onBlur={() => save(publishing)} />
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.customProfileLimit" })} hint={intl.formatMessage({ id: "settings.customProfileLimitHint" })}>
            <Field aria-label={intl.formatMessage({ id: "settings.customProfileLimit" })} type="number" min="0" step="1" value={publishing.customProfile.characterLimit} onChange={(event) => updateCustom({ characterLimit: Math.max(0, Number(event.target.value) || 0) })} onBlur={() => save(publishing)} />
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} hint={intl.formatMessage({ id: "settings.defaultArticleLanguageHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} value={general.defaultArticleLanguage} onChange={(event) => void saveGeneral({ ...general, defaultArticleLanguage: event.target.value, defaultTranslationLanguages: general.defaultTranslationLanguages.filter((language) => language !== event.target.value) })}>{articleLanguages.map((language) => <option key={language} value={language}>{intl.formatMessage({ id: languageMessageIds[language] })}</option>)}</Select>
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} hint={intl.formatMessage({ id: "settings.defaultTranslationLanguagesHint" })}>
            <div role="group" aria-label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">{articleLanguages.filter((language) => language !== general.defaultArticleLanguage).map((language) => <label key={language} className="flex min-h-8 items-center gap-2 text-sm text-ink"><input className="size-4 accent-brand" type="checkbox" checked={general.defaultTranslationLanguages.includes(language)} onChange={(event) => void saveGeneral({ ...general, defaultTranslationLanguages: event.target.checked ? [...general.defaultTranslationLanguages, language] : general.defaultTranslationLanguages.filter((item) => item !== language) })} />{intl.formatMessage({ id: languageMessageIds[language] })}</label>)}</div>
        </SettingRow>
    </>;
}
