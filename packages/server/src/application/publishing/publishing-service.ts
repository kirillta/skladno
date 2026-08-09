import { defaultPublishLimitProfileId, isPublishLimitProfileId, type PublishLimitProfileId } from "@skladno/shared";

import type { SettingsStore } from "../ports/settings-store.js";


const publishLimitProfileSettingKey = "publish-limit-profile";


export class PublishingService {
    constructor(private readonly store: SettingsStore) { }


    getProfile(): PublishLimitProfileId {
        const saved = this.store.get(publishLimitProfileSettingKey)?.value;
        return isPublishLimitProfileId(saved) ? saved : defaultPublishLimitProfileId;
    }


    setProfile(profileId: PublishLimitProfileId): PublishLimitProfileId {
        this.store.set(publishLimitProfileSettingKey, profileId);
        return profileId;
    }
}
