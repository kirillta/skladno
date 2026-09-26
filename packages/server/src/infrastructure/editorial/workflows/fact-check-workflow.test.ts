import assert from "node:assert/strict";
import test from "node:test";
import type { FactCheck, FactCheckFinding } from "@skladno/shared";

import { streamFactCheck } from "./fact-check-workflow.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";


async function run(claim: string, prior: FactCheckFinding, matches: { claimIndex: number; factId: string }[] = []) {
    let researchCalls = 0;
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim }] }),
        matchClaims: async () => matches,
        researchClaims: async (claims) => {
            researchCalls += claims.length;
            return claims.map(({ claim: checkedClaim }) => ({ claim: checkedClaim, evidence: "New evidence", sources: [] }));
        },
        evaluateClaims: async (research) => ({ responseId: "evaluated", findings: research.map(({ claim: checkedClaim }) => ({
            claim: checkedClaim, status: "supported" as const, rationale: "New evidence", uncertainty: "Reviewed", sources: [],
        })) }),
    };
    let factCheck: FactCheck | undefined;
    for await (const event of streamFactCheck({ request: { article: claim, instructions: "Check facts", reusableFactFindings: [prior] }, signal: new AbortController().signal, provider })) {
        if (event.type === "completed")
            factCheck = event.factCheck;
    }

    assert.ok(factCheck);
    return { finding: factCheck.findings[0]!, researchCalls };
}


const base: FactCheckFinding = {
    factId: "8eae7936-c115-48d4-9093-acb27cef1e6f",
    claim: "The RFC was published in 1999.", status: "supported", rationale: "Original evidence",
    uncertainty: "Primary source", sources: [], checkedAt: "2026-01-01T00:00:00.000Z",
    reusedFromRevisionId: "revision-1",
};

test("rewritten unchanged Fact reuses evidence and accepted decisions", async () => {
    for (const resolution of ["accepted_as_written", "evidence_accepted"] as const) {
        const { finding, researchCalls } = await run("In 1999, the RFC was published.", { ...base, resolution }, [{ claimIndex: 0, factId: base.factId! }]);
        assert.equal(researchCalls, 0);
        assert.equal(finding.factId, base.factId);
        assert.equal(finding.checkedAt, base.checkedAt);
        assert.equal(finding.resolution, resolution);
        assert.equal(finding.reusedFromRevisionId, "revision-1");
    }
});

test("changed qualifiers and corrected or unverifiable Facts are checked again", async () => {
    const changed = await run("The RFC was published in 2001.", base, [{ claimIndex: 0, factId: base.factId! }]);
    assert.equal(changed.researchCalls, 1);
    assert.equal(changed.finding.factId, undefined);

    const negated = await run("The RFC was not published in 1999.", base, [{ claimIndex: 0, factId: base.factId! }]);
    assert.equal(negated.researchCalls, 1);

    for (const prior of [{ ...base, resolution: "corrected_or_removed" as const }, { ...base, status: "unverifiable" as const }]) {
        const { finding, researchCalls } = await run(base.claim, prior);
        assert.equal(researchCalls, 1);
        assert.equal(finding.factId, base.factId);
        assert.equal(finding.resolution, undefined);
        assert.equal(finding.reusedFromRevisionId, undefined);
    }

    const reappeared = await run("In 1999, the RFC was published.", { ...base, resolution: "corrected_or_removed" }, [{ claimIndex: 0, factId: base.factId! }]);
    assert.equal(reappeared.researchCalls, 1);
    assert.equal(reappeared.finding.factId, base.factId);
    assert.equal(reappeared.finding.resolution, undefined);
});

test("supported and disputed evidence can be reused without changing classification", async () => {
    for (const status of ["supported", "disputed"] as const) {
        const { finding, researchCalls } = await run(base.claim, { ...base, status });
        assert.equal(researchCalls, 0);
        assert.equal(finding.status, status);
    }
});
