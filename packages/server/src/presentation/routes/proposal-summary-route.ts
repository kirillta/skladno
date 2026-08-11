import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS } from "@skladno/shared";

import type { ProposalSummaryService } from "../../application/editorial/proposal-summary-service.js";
import { object, readJson, writeJson } from "../transport/json.js";


export async function summarizeProposalRoute(request: IncomingMessage, response: ServerResponse, summaries: ProposalSummaryService): Promise<void> {
    const controller = new AbortController();
    request.on("close", () => controller.abort());
    writeJson(response, HTTP_STATUS.OK, await summaries.summarize(object(await readJson(request)), controller.signal));
}
