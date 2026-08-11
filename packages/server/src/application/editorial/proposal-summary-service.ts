import { APPLICATION_ERROR, HTTP_STATUS, type ProposalChange, type ProposalChangeSummary } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";


function changes(value: unknown): ProposalChange[] {
    if (!Array.isArray(value) || value.length > 50)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    const result = value.filter((change): change is ProposalChange => Boolean(change)
        && typeof change === "object"
        && typeof (change as ProposalChange).id === "string"
        && Array.isArray((change as ProposalChange).baseLines)
        && Array.isArray((change as ProposalChange).proposalLines)
        && (change as ProposalChange).baseLines.every((line) => typeof line === "string")
        && (change as ProposalChange).proposalLines.every((line) => typeof line === "string"));

    if (result.length !== value.length)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return result;
}


export class ProposalSummaryService {
    constructor(private readonly engines: EditorialEngineResolver) { }


    async summarize(value: unknown, signal: AbortSignal): Promise<ProposalChangeSummary[]> {
        const input = value && typeof value === "object" ? value as { changes?: unknown } : {};
        const requestedChanges = changes(input.changes);
        const generator = this.engines.resolveProposalSummaryGenerator?.();
        if (!generator)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        return generator.summarize(requestedChanges, signal);
    }
}
