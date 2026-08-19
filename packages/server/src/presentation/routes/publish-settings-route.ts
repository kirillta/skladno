import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS } from "@skladno/shared";

import { PublishingService } from "../../application/publishing/publishing-service.js";
import { object, readJson, writeJson } from "../transport/json.js";


export function handlePublishSettingsRoute(response: ServerResponse, publishing: PublishingService): void {
    writeJson(response, HTTP_STATUS.OK, publishing.getSettings());
}


export async function updatePublishSettingsRoute(request: IncomingMessage, response: ServerResponse, publishing: PublishingService): Promise<void> {
    const body = object(await readJson(request));
    writeJson(response, HTTP_STATUS.OK, publishing.setSettings(body));
}
