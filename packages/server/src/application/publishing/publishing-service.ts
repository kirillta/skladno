import { defaultPublishingSettings, isPublishLimitProfileId, type PublishingSettings } from "@skladno/shared";

import type { SettingsStore } from "../ports/settings-store.js";


const publishLimitProfileSettingKey = "publish-limit-profile";


export class PublishingService {
    constructor(private readonly store: SettingsStore) { }


    getSettings(): PublishingSettings {
        const saved = this.store.get(publishLimitProfileSettingKey)?.value;
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
            const candidate = saved as { defaultProfileId?: unknown; customProfile?: { name?: unknown; characterLimit?: unknown } };
            const limit = candidate.customProfile?.characterLimit;

            if (isPublishLimitProfileId(candidate.defaultProfileId) && typeof candidate.customProfile?.name === "string" && typeof limit === "number" && Number.isInteger(limit) && limit >= 0)
                return { defaultProfileId: candidate.defaultProfileId, customProfile: { name: candidate.customProfile.name, characterLimit: limit } };
        }

        return { ...defaultPublishingSettings, customProfile: { ...defaultPublishingSettings.customProfile } };
    }


    setSettings(settings: PublishingSettings): PublishingSettings {
        this.store.set(publishLimitProfileSettingKey, settings);
        return settings;
    }
}
