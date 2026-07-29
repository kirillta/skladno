import type { IncomingMessage, ServerResponse } from "node:http";
import {
    defaultPublishLimitProfileId,
    HTTP_METHOD,
    HTTP_STATUS,
    isPublishLimitProfileId,
    publishSettingsPath,
    type PublishLimitProfileId,
} from "@skladno/shared";

import { Repositories } from "../../persistence/index.js";
import { object, readJson, writeJson } from "../json.js";

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
            throw new Error("profileId must be a supported publish limit profile.");

        const profileId: PublishLimitProfileId = body.profileId;
        repositories.setSetting(publishLimitProfileSettingKey, profileId);
        writeJson(response, HTTP_STATUS.OK, { profileId });
        return true;
    }

    return false;
}
