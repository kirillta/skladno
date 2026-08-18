import type { IncomingMessage, ServerResponse } from "node:http";
import {
    APPLICATION_ERROR,
    HTTP_STATUS,
    isPublishLimitProfileId,
    type PublishingSettings,
} from "@skladno/shared";

import { PublishingService } from "../../application/publishing/publishing-service.js";
import { object, readJson, writeJson } from "../transport/json.js";
import { ApplicationServiceError } from "../errors/application-error.js";


export function handlePublishSettingsRoute(response: ServerResponse, publishing: PublishingService): void {
    writeJson(response, HTTP_STATUS.OK, publishing.getSettings());
}


export async function updatePublishSettingsRoute(request: IncomingMessage, response: ServerResponse, publishing: PublishingService): Promise<void> {
    const body = object(await readJson(request));
    const customProfile = body.customProfile as { name?: unknown; characterLimit?: unknown } | undefined;
    const limit = customProfile?.characterLimit;
    if (!isPublishLimitProfileId(body.defaultProfileId) || !customProfile || typeof customProfile !== "object" || Array.isArray(customProfile) || typeof customProfile.name !== "string" || !customProfile.name.trim() || typeof limit !== "number" || !Number.isInteger(limit) || limit < 0)
        throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

    const settings: PublishingSettings = { defaultProfileId: body.defaultProfileId, customProfile: { name: customProfile.name.trim(), characterLimit: limit } };

    writeJson(response, HTTP_STATUS.OK, publishing.setSettings(settings));
}
