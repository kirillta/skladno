import type { FactCheck } from "@skladno/shared";

import type { EditorialEngineEvent } from "../../../application/editorial/engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../../../application/editorial/engine/editorial-engine-events.js";
import type { FactCheckRequest } from "../models/fact-check-request.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import { inheritFactIdentity, matchFactCandidates, partitionFactClaims } from "./fact-claim-matching.js";


export async function* streamFactCheck({ request, signal, provider }: { request: FactCheckRequest; signal: AbortSignal; provider: FactCheckProvider }): AsyncIterable<EditorialEngineEvent> {
    const stages = ["claim_extraction", provider.researchStage, "evidence_evaluation", "classification", "citation_assembly"];
    for (const tool of stages)
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

    const extraction = await provider.extractClaims(request.article, request.instructions, signal);
    const matched = await matchFactCandidates(extraction.claims, request.reusableFactFindings ?? [], provider, signal);
    const { reusedFindings, claimsToCheck } = partitionFactClaims(extraction.claims, matched);

    yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: [
        ...reusedFindings.map(({ claim }) => ({ claim, checked: true })),
        ...claimsToCheck.map(({ claim }) => ({ claim, checked: false })),
    ] };

    if (!claimsToCheck.length) {
        yield* completeStages(stages);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: extraction.responseId, text: "", factCheck: { findings: reusedFindings } };
        return;
    }

    const research = await provider.researchClaims(claimsToCheck, request.instructions, signal);
    const evaluation = await provider.evaluateClaims(research, request.instructions, signal);
    const factCheck: FactCheck = {
        findings: [...reusedFindings, ...evaluation.findings.map((finding) => ({
            ...finding,
            ...inheritFactIdentity(finding.claim, extraction.claims, matched),
            sources: finding.sources
                .filter((source) => /^https:\/\//.test(source.url))
                .map(({ excerpt, publishedAt, ...source }) => ({
                    ...source,
                    ...(excerpt ? { excerpt } : {}),
                    ...(publishedAt ? { publishedAt } : {}),
                })),
        }))],
    };

    yield* completeStages(stages);
    yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: evaluation.responseId, text: "", factCheck };
}


async function* completeStages(stages: string[]): AsyncIterable<EditorialEngineEvent> {
    for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };
}
