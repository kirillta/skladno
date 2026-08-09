import type { ServerResponse } from "node:http";
import { HTTP_STATUS, type HealthResponse } from "@skladno/shared";

import { writeJson } from "../transport/json.js";


export function handleHealthRoute(response: ServerResponse): void {
    const body: HealthResponse = {
        status: "ok",
        service: "skladno-local-service",
        timestamp: new Date().toISOString(),
    };

    writeJson(response, HTTP_STATUS.OK, body);
}
