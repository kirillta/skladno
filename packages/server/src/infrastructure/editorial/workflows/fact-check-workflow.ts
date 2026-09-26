import type { FactCheck } from "@skladno/shared";

import type { EditorialEngineEvent } from "../../../application/editorial/engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../../../application/editorial/engine/editorial-engine-events.js";
import type { FactCheckRequest } from "../models/fact-check-request.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { inheritFactIdentity, matchFactCandidates, partitionFactClaims } from "./fact-claim-matching.js";


const concurrentChecks = 3;


export async function* streamFactCheck({ request, signal, provider }: { request: FactCheckRequest; signal: AbortSignal; provider: FactCheckProvider }): AsyncIterable<EditorialEngineEvent> {
    const stages = ["claim_extraction", provider.researchStage, "evidence_evaluation", "classification", "citation_assembly"];
    for (const tool of stages)
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

    const extraction = await provider.extractClaims(request.article, request.instructions, signal);
    const matched = await matchFactCandidates(extraction.claims, request.reusableFactFindings ?? [], provider, signal);
    const { reusedFindings, claimsToCheck } = partitionFactClaims(extraction.claims, matched);

    yield {
        type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: [
            ...reusedFindings.map(({ claim }) => ({ claim, checked: true })),
            ...claimsToCheck.map(({ claim }) => ({ claim, checked: false })),
        ]
    };

    if (!claimsToCheck.length) {
        yield* completeStages(stages);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: extraction.responseId, text: "", factCheck: { findings: reusedFindings } };
        return;
    }

    if (reusedFindings.length)
        yield { type: EDITORIAL_ENGINE_EVENT.FACT_CHECK_PROGRESS, factCheck: { findings: reusedFindings } };

    const pending = new Map<number, Promise<{ index: number; responseId: string; findings: FactCheck["findings"] }>>();
    const checked = new Map<number, FactCheck["findings"]>();
    let nextClaim = 0;
    let responseId = extraction.responseId;
    let findings = reusedFindings;
    const startChecks = () => {
        while (pending.size < concurrentChecks && nextClaim < claimsToCheck.length) {
            const index = nextClaim++;
            pending.set(index, checkClaim(claimsToCheck[index]!, request.instructions, signal, provider, extraction.claims, matched)
                .then((result) => ({ ...result, index })));
        }
    };

    startChecks();

    while (pending.size) {
        const result = await Promise.race(pending.values());
        signal.throwIfAborted();
        pending.delete(result.index);
        checked.set(result.index, result.findings);
        responseId = result.responseId;
        findings = [...reusedFindings, ...[...checked].sort(([left], [right]) => left - right).flatMap(([, completed]) => completed)];

        yield { type: EDITORIAL_ENGINE_EVENT.FACT_CHECK_PROGRESS, factCheck: { findings } };

        startChecks();
    }

    yield* completeStages(stages);
    yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId, text: "", factCheck: { findings } };
}


async function checkClaim(claim: { claim: string }, instructions: string, signal: AbortSignal, provider: FactCheckProvider, claims: { claim: string }[], matched: Map<number, FactCheck["findings"][number]>) {
    const research = await provider.researchClaims([claim], instructions, signal);
    signal.throwIfAborted();

    const evaluation = await provider.evaluateClaims(research, instructions, signal);
    signal.throwIfAborted();
    if (evaluation.findings.length !== 1)
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return {
        responseId: evaluation.responseId,
        findings: evaluation.findings.map((finding) => ({
            ...finding,
            claim: claim.claim,
            ...inheritFactIdentity(claim.claim, claims, matched),
            sources: finding.sources
                .filter((source) => /^https:\/\//.test(source.url))
                .map(({ excerpt, publishedAt, ...source }) => ({
                    ...source,
                    ...(excerpt ? { excerpt } : {}),
                    ...(publishedAt ? { publishedAt } : {}),
                })),
        })),
    };
}


async function* completeStages(stages: string[]): AsyncIterable<EditorialEngineEvent> {
    for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };
}
