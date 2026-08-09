import type { IncomingMessage, ServerResponse } from "node:http";
import {
    APPLICATION_ERROR,
    HTTP_STATUS,
    isPublishLimitProfileId,
    type PublishLimitProfileId,
} from "@skladno/shared";

import { PublishingService } from "../../application/publishing/publishing-service.js";
import { object, readJson, writeJson } from "../transport/json.js";
import { ApplicationServiceError } from "../errors/application-error.js";

export function handlePublishSettingsRoute(response: ServerResponse, publishing: PublishingService): void {
    const profileId = publishing.getProfile();

    writeJson(response, HTTP_STATUS.OK, { profileId });
}


export async function updatePublishSettingsRoute(request: IncomingMessage, response: ServerResponse, publishing: PublishingService): Promise<void> {
    const body = object(await readJson(request));
    if (!isPublishLimitProfileId(body.profileId))
        throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

    const profileId: PublishLimitProfileId = body.profileId;

    writeJson(response, HTTP_STATUS.OK, { profileId: publishing.setProfile(profileId) });
}
