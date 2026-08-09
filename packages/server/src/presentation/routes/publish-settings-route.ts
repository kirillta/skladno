import type { IncomingMessage, ServerResponse } from "node:http";
import {
    APPLICATION_ERROR,
    HTTP_METHOD,
    HTTP_STATUS,
    isPublishLimitProfileId,
    publishSettingsPath,
    type PublishLimitProfileId,
} from "@skladno/shared";

import { PublishingService } from "../../application/publishing/publishing-service.js";
import { object, readJson, writeJson } from "../transport/json.js";
import { ApplicationServiceError } from "../errors/application-error.js";

export async function handlePublishSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, publishing: PublishingService): Promise<boolean> {
    if (pathname !== publishSettingsPath)
        return false;

    if (request.method === HTTP_METHOD.GET) {
        const profileId = publishing.getProfile();

        writeJson(response, HTTP_STATUS.OK, { profileId });
        return true;
    }

    if (request.method === HTTP_METHOD.PUT) {
        const body = object(await readJson(request));
        if (!isPublishLimitProfileId(body.profileId))
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        const profileId: PublishLimitProfileId = body.profileId;

        writeJson(response, HTTP_STATUS.OK, { profileId: publishing.setProfile(profileId) });
        return true;
    }

    return false;
}
