import type { FactCheck, FactCheckClaimPreview, FactCheckFinding } from "@skladno/shared";

import type { EditorialEngineEvent } from "../../../application/editorial/engine/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../../../application/editorial/engine/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import type { FactCheckRequest } from "../models/fact-check-request.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import type { FactCheckResearch } from "../models/fact-check-research.js";
import { inheritFactIdentity, matchFactCandidates, partitionFactClaims } from "./fact-claim-matching.js";


const concurrentChecks = 3;


export async function* streamFactCheck({ request, signal, provider }: { request: FactCheckRequest; signal: AbortSignal; provider: FactCheckProvider }): AsyncIterable<EditorialEngineEvent> {
    const stages = ["claim_extraction", provider.researchStage, "evidence_evaluation", "classification", "citation_assembly"];
    for (const tool of stages)
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "started" };

    const previousFindings = request.reusableFactFindings ?? [];
    const extracted = await provider.extractClaims(request.article, request.instructions, signal, previousFindings);
    const extraction = { ...extracted, claims: retainExistingClaims(request.article, extracted.claims, previousFindings) };
    yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: extraction.claims.map(({ claim }) => ({ claim, checked: false })) };

    const matched = await matchFactCandidates(extraction.claims, previousFindings, provider, signal);
    const { reusedFindings, claimsToCheck } = partitionFactClaims(extraction.claims, matched);

    yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "completed", claims: previewClaims(extraction.claims, reusedFindings) };

    if (!claimsToCheck.length) {
        yield* completeStages(stages);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: extraction.responseId, text: "", factCheck: { findings: reusedFindings } };
        return;
    }

    if (reusedFindings.length)
        yield { type: EDITORIAL_ENGINE_EVENT.FACT_CHECK_PROGRESS, factCheck: { findings: reusedFindings } };

    const result = yield* researchClaims(request, signal, provider, extraction, matched, reusedFindings, claimsToCheck);

    yield* completeStages(stages);
    yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: result.responseId, text: "", factCheck: { findings: result.findings, ...(result.failed ? { incomplete: true } : {}) } };
}


async function* researchClaims(request: FactCheckRequest, signal: AbortSignal, provider: FactCheckProvider, extraction: Awaited<ReturnType<FactCheckProvider["extractClaims"]>>, matched: Map<number, FactCheck["findings"][number]>, reusedFindings: FactCheck["findings"], claimsToCheck: { claim: string }[]): AsyncGenerator<EditorialEngineEvent, { responseId: string; findings: FactCheck["findings"]; failed: boolean }> {
    const pending = new Map<number, Promise<{ index: number; responseId: string; findings: FactCheck["findings"] } | { index: number; error: unknown }>>();
    const checked = new Map<number, FactCheck["findings"]>();
    const started = new Set<number>();
    let responseId = extraction.responseId;
    let findings = reusedFindings;
    let failed = false;
    let firstError: unknown;
    const startChecks = () => {
        for (const [index, claim] of claimsToCheck.entries()) {
            if (failed || pending.size >= concurrentChecks)
                break;

            if (started.has(index))
                continue;

            if (request.skipFactCheckClaim?.(claim.claim))
                continue;

            started.add(index);
            pending.set(index, checkClaim(claim, request.instructions, signal, provider, extraction.claims, matched)
                .then((result) => ({ ...result, index }), (error: unknown) => ({ index, error })));
        }
    };

    startChecks();
    if (pending.size)
        yield {
            type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS,
            tool: "claim_extraction",
            status: "completed",
            claims: previewClaims(extraction.claims, reusedFindings, new Set(), new Set([...pending.keys()].map((index) => claimsToCheck[index]!.claim)))
        };

    while (pending.size) {
        const result = await Promise.race(pending.values());
        signal.throwIfAborted();
        pending.delete(result.index);
        if ("error" in result) {
            if (!request.skipFactCheckClaim?.(claimsToCheck[result.index]!.claim)) {
                firstError ??= result.error;
                failed = true;
            }
        } else {
            checked.set(result.index, result.findings);

            responseId = result.responseId;
            findings = [...reusedFindings, ...[...checked].sort(([left], [right]) => left - right).flatMap(([, completed]) => completed)];

            yield { type: EDITORIAL_ENGINE_EVENT.FACT_CHECK_PROGRESS, factCheck: { findings } };
        }

        startChecks();
        const completed = new Set([...checked.keys()].map((index) => claimsToCheck[index]!.claim));
        const checking = new Set([...pending.keys()].map((index) => claimsToCheck[index]!.claim));
        yield {
            type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS,
            tool: "claim_extraction",
            status: "completed",
            claims: previewClaims(extraction.claims, reusedFindings, completed, checking)
        };
    }

    if (failed && !findings.length)
        throw firstError;

    return { responseId, findings, failed };
}


function retainExistingClaims(article: string, extracted: { claim: string }[], previous: FactCheckFinding[]): { claim: string }[] {
    const current = new Set(extracted.map(({ claim }) => claim.trim().toLocaleLowerCase()));
    const claims = [...extracted];
    const articleText = article.toLocaleLowerCase();
    for (const { claim } of previous) {
        const key = claim.trim().toLocaleLowerCase();
        if (articleText.includes(key) && !current.has(key)) {
            claims.push({ claim });
            current.add(key);
        }
    }

    return claims.sort((left, right) => {
        const leftAt = articleText.indexOf(left.claim.toLocaleLowerCase());
        const rightAt = articleText.indexOf(right.claim.toLocaleLowerCase());
        return (leftAt < 0 ? articleText.length : leftAt) - (rightAt < 0 ? articleText.length : rightAt);
    });
}


function previewClaims(claims: { claim: string }[], reused: FactCheckFinding[], completed = new Set<string>(), checking = new Set<string>()): FactCheckClaimPreview[] {
    const reusedClaims = new Set(reused.map(({ claim }) => claim));
    return claims.map(({ claim }) => ({ claim, checked: reusedClaims.has(claim) || completed.has(claim), ...(checking.has(claim) ? { checking: true } : {}) }));
}


async function checkClaim(claim: { claim: string }, instructions: string, signal: AbortSignal, provider: FactCheckProvider, claims: { claim: string }[], matched: Map<number, FactCheck["findings"][number]>) {
    const research = await provider.researchClaims([claim], instructions, signal);
    signal.throwIfAborted();

    const evaluation = await provider.evaluateClaims(research, instructions, signal);
    signal.throwIfAborted();
    if (!evaluation.findings.length)
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    const evidenceUrls = getEvidenceUrls(research);
    if (evaluation.findings.some((finding) => finding.sources.some((source) => !evidenceUrls.has(source.url))))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return {
        responseId: evaluation.responseId,
        findings: evaluation.findings.map((finding) => ({
            ...finding,
            ...inheritFactIdentity(finding.claim, claims, matched),
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


function getEvidenceUrls(research: FactCheckResearch[]): Set<string> {
    const urls = new Set<string>();
    for (const { evidence, sources } of research) {
        for (const url of evidence.match(/https?:\/\/[^\s<>"'`]+/g) ?? [])
            urls.add(url.replace(/[.,;:!?)}\]]+$/, ""));

        for (const url of getProviderSourceUrls(sources))
            urls.add(url);
    }

    return urls;
}


function getProviderSourceUrls(sources: unknown): string[] {
    if (!Array.isArray(sources))
        return [];

    return sources.flatMap((source) => source && typeof source === "object" && "url" in source && typeof source.url === "string" ? [source.url] : []);
}


async function* completeStages(stages: string[]): AsyncIterable<EditorialEngineEvent> {
    for (const tool of stages.filter((tool) => tool !== "claim_extraction"))
        yield { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool, status: "completed" };
}
