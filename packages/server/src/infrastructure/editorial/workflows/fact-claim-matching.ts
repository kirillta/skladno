import { FACT_CHECK_STATUS, type FactCheckFinding } from "@skladno/shared";

import type { FactCheckProvider } from "../models/fact-check-provider.js";


interface Claim { claim: string }


export async function matchFactCandidates(claims: Claim[], history: FactCheckFinding[], provider: FactCheckProvider, signal: AbortSignal): Promise<Map<number, FactCheckFinding>> {
    const byClaim = new Map<string, FactCheckFinding>();
    for (const finding of history) {
        const key = normalizeClaim(finding.claim);
        if (!byClaim.has(key))
            byClaim.set(key, finding);
    }

    const byId = new Map(history.flatMap((finding) => finding.factId ? [[finding.factId, finding] as const] : []));
    const matched = new Map<number, FactCheckFinding>();
    const used = new Set<string>();

    for (const [index, { claim }] of claims.entries()) {
        const finding = byClaim.get(normalizeClaim(claim));
        if (finding?.factId && !used.has(finding.factId)) {
            matched.set(index, finding);
            used.add(finding.factId);
        }
    }

    if (!provider.matchClaims)
        return matched;

    const unresolved = claims.flatMap(({ claim }, index) => matched.has(index) ? [] : [{ claim, index }]);
    const candidates = [...byId.values()].filter((finding) => !used.has(finding.factId!));
    if (!unresolved.length || !candidates.length)
        return matched;

    const matches = await provider.matchClaims(unresolved.map(({ claim }) => claim), candidates.map(({ factId, claim }) => ({ factId: factId!, claim })), signal);
    for (const { claimIndex, factId } of matches) {
        const index = unresolved[claimIndex]?.index;
        const finding = byId.get(factId);
        if (index === undefined || !finding || matched.has(index) || used.has(factId) || !sameMaterialAnchors(claims[index]!.claim, finding.claim))
            continue;

        matched.set(index, finding);
        used.add(factId);
    }

    return matched;
}


export function partitionFactClaims(claims: Claim[], matched: Map<number, FactCheckFinding>): { reusedFindings: FactCheckFinding[]; claimsToCheck: Claim[] } {
    const reusedFindings: FactCheckFinding[] = [];
    const claimsToCheck: Claim[] = [];
    for (const [index, { claim }] of claims.entries()) {
        const previous = matched.get(index);
        if (previous && previous.status !== FACT_CHECK_STATUS.UNVERIFIABLE && previous.resolution !== "corrected_or_removed")
            reusedFindings.push({ ...previous, claim });
        else
            claimsToCheck.push({ claim });
    }

    return { reusedFindings, claimsToCheck };
}


export function inheritFactIdentity(claim: string, claims: Claim[], matched: Map<number, FactCheckFinding>): Pick<FactCheckFinding, "factId" | "resolution"> {
    const index = claims.findIndex((candidate) => normalizeClaim(candidate.claim) === normalizeClaim(claim));
    const previous = matched.get(index);
    if (!previous)
        return {};

    return {
        factId: previous.factId,
        ...(previous.resolution && previous.resolution !== "corrected_or_removed" ? { resolution: previous.resolution } : {}),
    };
}


function normalizeClaim(claim: string): string {
    return claim.trim().toLowerCase().replace(/\s+/g, " ");
}


function sameMaterialAnchors(current: string, previous: string): boolean {
    const numbers = (text: string) => [...text.matchAll(/\b\d+(?:[.,]\d+)*%?\b/g)].map(([value]) => value).sort().join("|");
    const negated = (text: string) => /\b(?:not|no|never|none|without|cannot|can't|won't|isn't|wasn't|doesn't|didn't)\b/i.test(text);
    
    return numbers(current) === numbers(previous) && negated(current) === negated(previous);
}
