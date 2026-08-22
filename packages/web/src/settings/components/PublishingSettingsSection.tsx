import { articleLanguages, isPublishLimitProfileId, PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type CustomPublishLimitProfile, type GeneralSettings, type PublishingSettings } from "@skladno/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button, Field, Select } from "../../ui/primitives.js";
import { CustomProfileRemovalDialog } from "./CustomProfileRemovalDialog.js";
import { SettingRow } from "./SettingRow.js";

const languageMessageIds = { en: "languages.english", es: "languages.spanish", pt: "languages.portuguese", ru: "languages.russian", fr: "languages.french", de: "languages.german", it: "languages.italian" } as const;


export function PublishingSettingsSection({ publishing, save, general, saveGeneral }: { publishing: PublishingSettings; save: (next: PublishingSettings) => void; general: GeneralSettings; saveGeneral: (next: GeneralSettings) => Promise<void> }) {
    const intl = useIntl();
    const [name, setName] = useState("");
    const [limit, setLimit] = useState("");
    const [pendingRemoval, setPendingRemoval] = useState<CustomPublishLimitProfile>();
    const parsedLimit = Number(limit);
    const valid = Boolean(name.trim()) && Number.isInteger(parsedLimit) && parsedLimit >= 0;
    const profiles = [...publishLimitProfiles, ...publishing.customProfiles];
    const label = (id: string) => id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS ? intl.formatMessage({ id: "publishing.noRestrictions" }) : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_POST ? intl.formatMessage({ id: "publishing.linkedInPost" }) : id === PUBLISH_LIMIT_PROFILE.LINKEDIN_ARTICLE ? intl.formatMessage({ id: "publishing.linkedInArticle" }) : publishing.customProfiles.find((profile) => profile.id === id)?.name ?? intl.formatMessage({ id: "publishing.default" });


    function addCustomProfile() {
        if (!valid)
            return;

        save({ ...publishing, customProfiles: [...publishing.customProfiles, { id: `custom-${crypto.randomUUID()}`, name: name.trim(), characterLimit: parsedLimit }] });
        setName("");
        setLimit("");
    }


    function removeCustomProfile(profileId: string) {
        save({ ...publishing, defaultProfileId: publishing.defaultProfileId === profileId ? PUBLISH_LIMIT_PROFILE.DEFAULT : publishing.defaultProfileId, customProfiles: publishing.customProfiles.filter((profile) => profile.id !== profileId) });
    }


    function confirmRemoval() {
        if (!pendingRemoval)
            return;

        removeCustomProfile(pendingRemoval.id);
        setPendingRemoval(undefined);
    }


    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.publishingProfile" })} hint={intl.formatMessage({ id: "settings.publishingProfileHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.publishingProfile" })} value={publishing.defaultProfileId} onChange={(event) => {
                const value = event.target.value;
                if (isPublishLimitProfileId(value) && profiles.some((profile) => profile.id === value))
                    save({ ...publishing, defaultProfileId: value });
            }}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{label(profile.id)}{profile.characterLimit === undefined ? "" : ` (${intl.formatNumber(profile.characterLimit)})`}</option>)}</Select>
        </SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.customProfiles" })} hint={intl.formatMessage({ id: "settings.customProfilesHint" })} status={!valid && (name || limit) ? intl.formatMessage({ id: "settings.customProfileInvalid" }) : undefined} action={<Button variant="secondary" disabled={!valid} onClick={addCustomProfile}>{intl.formatMessage({ id: "settings.saveCustomProfile" })}</Button>}>
            <div className="space-y-2">
                <div className="space-y-2">
                    {publishing.customProfiles.map((profile) => <div key={profile.id} className="flex items-center gap-3 text-sm text-muted">
                        <span>{profile.name} · {intl.formatNumber(profile.characterLimit)}</span>
                        <Button className="ml-auto" variant="quiet" onClick={() => setPendingRemoval(profile)} aria-label={intl.formatMessage({ id: "settings.removeCustomProfile" }, { name: profile.name })}>{intl.formatMessage({ id: "settings.remove" })}</Button>
                    </div>)}
                </div>
                <div className="mt-5 space-y-2 border-t border-border pt-5">
                    <p className="text-sm font-semibold text-ink">{intl.formatMessage({ id: "settings.addCustomProfile" })}</p>
                    <Field aria-label={intl.formatMessage({ id: "settings.customProfileName" })} value={name} placeholder={intl.formatMessage({ id: "settings.customProfileName" })} onChange={(event) => setName(event.target.value)} />
                    <Field aria-label={intl.formatMessage({ id: "settings.customProfileLimit" })} type="number" min="0" step="1" value={limit} placeholder="3000" onChange={(event) => setLimit(event.target.value)} />
                </div>
            </div>
        </SettingRow>
        {pendingRemoval && <CustomProfileRemovalDialog profile={pendingRemoval} isDefault={publishing.defaultProfileId === pendingRemoval.id} close={() => setPendingRemoval(undefined)} remove={confirmRemoval} />}
        <SettingRow label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} hint={intl.formatMessage({ id: "settings.defaultArticleLanguageHint" })}><Select aria-label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} value={general.defaultArticleLanguage} onChange={(event) => void saveGeneral({ ...general, defaultArticleLanguage: event.target.value, defaultTranslationLanguages: general.defaultTranslationLanguages.filter((language) => language !== event.target.value) })}>{articleLanguages.map((language) => <option key={language} value={language}>{intl.formatMessage({ id: languageMessageIds[language] })}</option>)}</Select></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} hint={intl.formatMessage({ id: "settings.defaultTranslationLanguagesHint" })}><div role="group" aria-label={intl.formatMessage({ id: "settings.defaultTranslationLanguages" })} className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">{articleLanguages.filter((language) => language !== general.defaultArticleLanguage).map((language) => <label key={language} className="flex min-h-8 items-center gap-2 text-sm text-ink"><input className="size-4 accent-brand" type="checkbox" checked={general.defaultTranslationLanguages.includes(language)} onChange={(event) => void saveGeneral({ ...general, defaultTranslationLanguages: event.target.checked ? [...general.defaultTranslationLanguages, language] : general.defaultTranslationLanguages.filter((item) => item !== language) })} />{intl.formatMessage({ id: languageMessageIds[language] })}</label>)}</div></SettingRow>
    </>;
}
