import { defaultPublishingSettings, isPublishLimitProfileId, type PublishingSettings } from "@skladno/shared";

import type { SettingsStore } from "../ports/settings-store.js";


const publishLimitProfileSettingKey = "publish-limit-profile";


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


    setSettings(settings: PublishingSettings): PublishingSettings {
        this.store.set(publishLimitProfileSettingKey, settings);
        return settings;
    }
}
