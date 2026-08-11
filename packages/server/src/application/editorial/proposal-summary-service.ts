import { APPLICATION_ERROR, HTTP_STATUS, type ProposalChange, type ProposalChangeSummary } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";


interface ProposalSummaryArtifactStore {
    get(artifactId: string, articleId: string): { content: string } | undefined;
    updateContent(artifactId: string, articleId: string, content: string): void;
}


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
    constructor(
        private readonly engines: EditorialEngineResolver,
        private readonly artifacts: ProposalSummaryArtifactStore,
    ) { }


    async summarize(articleId: string, value: unknown, signal: AbortSignal): Promise<ProposalChangeSummary[]> {
        const input = value && typeof value === "object" ? value as { editorialArtifactId?: unknown; interfaceLocale?: unknown; changes?: unknown } : {};
        if (typeof input.editorialArtifactId !== "string" || typeof input.interfaceLocale !== "string" || !input.interfaceLocale.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const requestedChanges = changes(input.changes);
        const artifact = this.artifacts.get(input.editorialArtifactId, articleId);
        if (!artifact)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const content = JSON.parse(artifact.content) as { proposalSummaries?: ProposalChangeSummary[]; proposalSummaryLocale?: string; [key: string]: unknown };
        if (content.proposalSummaryLocale === input.interfaceLocale && Array.isArray(content.proposalSummaries))
            return content.proposalSummaries;

        const generator = this.engines.resolveProposalSummaryGenerator?.();
        if (!generator)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        const summaries = await generator.summarize(requestedChanges, input.interfaceLocale, signal);
        this.artifacts.updateContent(input.editorialArtifactId, articleId, JSON.stringify({
            ...content,
            proposalSummaries: summaries,
            proposalSummaryLocale: input.interfaceLocale,
        }));

        return summaries;
    }
}
