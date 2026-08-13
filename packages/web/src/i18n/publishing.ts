import { PUBLISH_LIMIT_PROFILE, type PublishLimitProfileId } from "@skladno/shared";
import type { MessageId } from "./messages.js";


export function publishingProfileMessageId(id: PublishLimitProfileId): MessageId {
    return id === PUBLISH_LIMIT_PROFILE.LINKEDIN_SHORT ? "publishing.linkedInShort" : "publishing.linkedInPost";
}
