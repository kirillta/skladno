import type { IncomingMessage, ServerResponse } from "node:http";
import {
    APPLICATION_ERROR,
    defaultPublishLimitProfileId,
    HTTP_METHOD,
    HTTP_STATUS,
    isPublishLimitProfileId,
    publishSettingsPath,
    type PublishLimitProfileId,
} from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { object, readJson, writeJson } from "../json.js";
import { ApplicationServiceError } from "../application-error.js";

const publishLimitProfileSettingKey = "publish-limit-profile";


export async function handlePublishSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== publishSettingsPath)
        return false;

    if (request.method === HTTP_METHOD.GET) {
        const saved = repositories.getSetting(publishLimitProfileSettingKey)?.value;
        const profileId = isPublishLimitProfileId(saved) ? saved : defaultPublishLimitProfileId;
        writeJson(response, HTTP_STATUS.OK, { profileId });
        return true;
    }

    if (request.method === HTTP_METHOD.PUT) {
        const body = object(await readJson(request));
        if (!isPublishLimitProfileId(body.profileId))
            throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

        const profileId: PublishLimitProfileId = body.profileId;
        repositories.setSetting(publishLimitProfileSettingKey, profileId);
        writeJson(response, HTTP_STATUS.OK, { profileId });
        return true;
    }

    return false;
}
