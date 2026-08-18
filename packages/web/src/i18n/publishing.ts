import { PUBLISH_LIMIT_PROFILE, type PublishLimitProfileId } from "@skladno/shared";
import type { MessageId } from "./messages.js";


export function publishingProfileMessageId(id: PublishLimitProfileId): MessageId {
    if (id === PUBLISH_LIMIT_PROFILE.DEFAULT)
        return "publishing.default";

    if (id === PUBLISH_LIMIT_PROFILE.LINKEDIN_POST)
        return "publishing.linkedInPost";

    if (id === PUBLISH_LIMIT_PROFILE.LINKEDIN_ARTICLE)
        return "publishing.linkedInArticle";

    return "publishing.noRestrictions";
}
