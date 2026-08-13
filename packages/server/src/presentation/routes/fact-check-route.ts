import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";
import type { FactCheckService } from "../../application/editorial/fact-check-service.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { object, readJson, string, writeJson } from "../transport/json.js";

const resolutions = new Set(["corrected_or_removed", "accepted_as_written", "evidence_accepted"]);


export function listFactChecksRoute(response: ServerResponse, articleId: string, factChecks: FactCheckService): void {
    writeJson(response, HTTP_STATUS.OK, factChecks.list(articleId));
}


export async function resolveFactCheckRoute(request: IncomingMessage, response: ServerResponse, articleId: string, occurrenceId: string, factChecks: FactCheckService): Promise<void> {
    const body = object(await readJson(request));
    const resolution = string(body.resolution, "resolution");
    if (!resolutions.has(resolution))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    factChecks.resolve(occurrenceId, resolution as "corrected_or_removed" | "accepted_as_written" | "evidence_accepted");
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}
