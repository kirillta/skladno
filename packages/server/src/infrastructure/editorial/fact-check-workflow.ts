import { FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding } from "@skladno/shared";

import type { EditorialEngineEvent } from "../../application/ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";


export interface FactCheckResearch {
    claim: string;
    evidence: string;
    sources: unknown;
}


export interface FactCheckFindingDraft {
    claim: string;
    status: FactCheckFinding["status"];
    rationale: string;
    uncertainty: string;
    sources: {
        url: string;
        title: string;
        excerpt: string | null;
        quality: FactCheckFinding["sources"][number]["quality"];
        publishedAt: string | null;
    }[];
}


export interface FactCheckProvider {
    researchStage: string;
    extractClaims(article: string, signal: AbortSignal): Promise<{ responseId: string; claims: { claim: string }[] }>;
    researchClaims(claims: { claim: string }[], signal: AbortSignal): Promise<FactCheckResearch[]>;
    evaluateClaims(research: FactCheckResearch[], signal: AbortSignal): Promise<{ responseId: string; findings: FactCheckFindingDraft[] }>;
}


interface FactCheckRequest {
    article: string;
    reusableFactFindings?: FactCheckFinding[];
}


export async function* streamFactCheck({ request, signal, provider }: { request: FactCheckRequest; signal: AbortSignal; provider: FactCheckProvider }): AsyncIterable<EditorialEngineEvent> {
    const stages = ["claim_extraction", provider.researchStage, "evidence_evaluation", "classification", "citation_assembly"];
    for (const tool of stages)
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

    const extraction = await provider.extractClaims(request.article, signal);
    const reusableByClaim = new Map<string, FactCheckFinding>();
    for (const finding of request.reusableFactFindings ?? []) {
        const key = normalizeClaim(finding.claim);
        if (finding.status === FACT_CHECK_STATUS.SUPPORTED && !reusableByClaim.has(key))
            reusableByClaim.set(key, finding);
    }

    const reusedFindings: FactCheckFinding[] = [];
    const claimsToCheck = extraction.claims.filter(({ claim }) => {
        const reusable = reusableByClaim.get(normalizeClaim(claim));
        if (!reusable)
            return true;

        reusedFindings.push({ ...reusable, claim });
        return false;
    });

    yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: [
        ...reusedFindings.map(({ claim }) => ({ claim, checked: true })),
        ...claimsToCheck.map(({ claim }) => ({ claim, checked: false })),
    ] };

    if (!claimsToCheck.length) {
        yield* completeStages(stages);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: extraction.responseId, text: "", factCheck: { findings: reusedFindings } };
        return;
    }

    const research = await provider.researchClaims(claimsToCheck, signal);
    const evaluation = await provider.evaluateClaims(research, signal);
    const factCheck: FactCheck = {
        findings: [...reusedFindings, ...evaluation.findings.map((finding) => ({
            ...finding,
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


function normalizeClaim(claim: string): string {
    return claim.trim().toLowerCase().replace(/\s+/g, " ");
}


async function* completeStages(stages: string[]): AsyncIterable<EditorialEngineEvent> {
    for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };
}
