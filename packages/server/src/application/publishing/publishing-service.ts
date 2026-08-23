import {
    APPLICATION_ERROR,
    defaultPublishingSettings,
    HTTP_STATUS,
    isPublishLimitProfileId,
    type CustomPublishLimitProfile,
    type PublishingSettings
} from "@skladno/shared";
import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { SettingsStore } from "../ports/settings-store.js";


const publishLimitProfileSettingKey = "publish-limit-profile";


function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function isCustomPublishProfile(value: unknown): value is CustomPublishLimitProfile {
    return isRecord(value)
        && typeof value.id === "string"
        && value.id.startsWith("custom-")
        && typeof value.name === "string"
        && Boolean(value.name.trim())
        && typeof value.characterLimit === "number"
        && Number.isInteger(value.characterLimit)
        && value.characterLimit >= 0;
}


function publishingSettings(value: unknown): PublishingSettings | undefined {
    if (!isRecord(value) || !isPublishLimitProfileId(value.defaultProfileId) || !Array.isArray(value.customProfiles) || !value.customProfiles.every(isCustomPublishProfile))
        return undefined;

    const customProfiles = value.customProfiles;
    if (new Set(customProfiles.map((profile) => profile.id)).size !== customProfiles.length || (value.defaultProfileId.startsWith("custom-") && !customProfiles.some((profile) => profile.id === value.defaultProfileId)))
        return undefined;

    return { defaultProfileId: value.defaultProfileId, customProfiles: customProfiles.map((profile) => ({ ...profile, name: profile.name.trim() })) };
}


export class PublishingService {
    constructor(private readonly store: SettingsStore) { }


    getSettings(): PublishingSettings {
        return publishingSettings(this.store.get(publishLimitProfileSettingKey)?.value) ?? { ...defaultPublishingSettings, customProfiles: [] };
    }


    setSettings(value: unknown): PublishingSettings {
        const settings = publishingSettings(value);
        if (!settings)
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        this.store.set(publishLimitProfileSettingKey, settings);
        return settings;
    }
}
