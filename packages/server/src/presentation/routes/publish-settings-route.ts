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
    const customProfiles = body.customProfiles;
    if (!Array.isArray(customProfiles) || !customProfiles.every((profile) => profile && typeof profile === "object" && !Array.isArray(profile) && isPublishLimitProfileId((profile as { id?: unknown }).id) && typeof (profile as { name?: unknown }).name === "string" && Boolean((profile as { name: string }).name.trim()) && typeof (profile as { characterLimit?: unknown }).characterLimit === "number" && Number.isInteger((profile as { characterLimit: number }).characterLimit) && (profile as { characterLimit: number }).characterLimit >= 0) || new Set(customProfiles.map((profile) => (profile as { id: string }).id)).size !== customProfiles.length || !isPublishLimitProfileId(body.defaultProfileId) || (String(body.defaultProfileId).startsWith("custom-") && !customProfiles.some((profile) => (profile as { id: string }).id === body.defaultProfileId)))
        throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

    const settings: PublishingSettings = { defaultProfileId: body.defaultProfileId, customProfiles: customProfiles.map((profile) => ({ id: (profile as { id: `custom-${string}` }).id, name: (profile as { name: string }).name.trim(), characterLimit: (profile as { characterLimit: number }).characterLimit })) };

    writeJson(response, HTTP_STATUS.OK, publishing.setSettings(settings));
}
