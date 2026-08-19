import { APPLICATION_ERROR, defaultPublishingSettings, HTTP_STATUS, isPublishLimitProfileId, type PublishingSettings } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { SettingsStore } from "../ports/settings-store.js";


const publishLimitProfileSettingKey = "publish-limit-profile";


function publishingSettings(value: unknown): PublishingSettings | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const candidate = value as { defaultProfileId?: unknown; customProfiles?: unknown };
    if (!isPublishLimitProfileId(candidate.defaultProfileId) || !Array.isArray(candidate.customProfiles))
        return undefined;

    const customProfiles = candidate.customProfiles;
    if (!customProfiles.every((profile) => profile && typeof profile === "object" && !Array.isArray(profile) && isPublishLimitProfileId((profile as { id?: unknown }).id) && typeof (profile as { name?: unknown }).name === "string" && Boolean((profile as { name: string }).name.trim()) && typeof (profile as { characterLimit?: unknown }).characterLimit === "number" && Number.isInteger((profile as { characterLimit: number }).characterLimit) && (profile as { characterLimit: number }).characterLimit >= 0) || new Set(customProfiles.map((profile) => (profile as { id: string }).id)).size !== customProfiles.length || (String(candidate.defaultProfileId).startsWith("custom-") && !customProfiles.some((profile) => (profile as { id: string }).id === candidate.defaultProfileId)))
        return undefined;

    return { defaultProfileId: candidate.defaultProfileId, customProfiles: customProfiles.map((profile) => ({ id: (profile as { id: `custom-${string}` }).id, name: (profile as { name: string }).name.trim(), characterLimit: (profile as { characterLimit: number }).characterLimit })) };
}


export class PublishingService {
    constructor(private readonly store: SettingsStore) { }


    getSettings(): PublishingSettings {
        const saved = this.store.get(publishLimitProfileSettingKey)?.value;
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
            const candidate = saved as { defaultProfileId?: unknown; customProfiles?: unknown };
            if (isPublishLimitProfileId(candidate.defaultProfileId) && Array.isArray(candidate.customProfiles) && candidate.customProfiles.every((profile): profile is { id: `custom-${string}`; name: string; characterLimit: number } => Boolean(profile) && typeof profile === "object" && isPublishLimitProfileId((profile as { id?: unknown }).id) && typeof (profile as { name?: unknown }).name === "string" && typeof (profile as { characterLimit?: unknown }).characterLimit === "number" && Number.isInteger((profile as { characterLimit: number }).characterLimit) && (profile as { characterLimit: number }).characterLimit >= 0))
                return { defaultProfileId: candidate.defaultProfileId, customProfiles: candidate.customProfiles };
        }

        return { ...defaultPublishingSettings, customProfiles: [] };
    }


    setSettings(value: unknown): PublishingSettings {
        const settings = publishingSettings(value);
        if (!settings)
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        this.store.set(publishLimitProfileSettingKey, settings);
        return settings;
    }
}
