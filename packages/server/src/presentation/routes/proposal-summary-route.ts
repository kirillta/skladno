import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_STATUS } from "@skladno/shared";

import type { ProposalSummaryService } from "../../application/editorial/proposal-summary-service.js";
import { object, readJson, writeJson } from "../transport/json.js";


export async function summarizeProposalRoute(request: IncomingMessage, response: ServerResponse, articleId: string, summaries: ProposalSummaryService): Promise<void> {
    const controller = new AbortController();
    request.once("aborted", () => controller.abort());
    response.once("close", () => {
        if (!response.writableEnded)
            controller.abort();
    });

    writeJson(response, HTTP_STATUS.OK, await summaries.summarize(articleId, object(await readJson(request)), controller.signal));
}
