import type { IncomingMessage, ServerResponse } from "node:http";
import { healthPath, HTTP_METHOD, HTTP_STATUS, type HealthResponse } from "@skladno/shared";

import { writeJson } from "../transport/json.js";


export function handleHealthRoute(request: IncomingMessage, response: ServerResponse): boolean {
    if (request.method !== HTTP_METHOD.GET || request.url !== healthPath)
        return false;

    const body: HealthResponse = {
        status: "ok",
        service: "skladno-local-service",
        timestamp: new Date().toISOString(),
    };

    writeJson(response, HTTP_STATUS.OK, body);
    return true;
}
