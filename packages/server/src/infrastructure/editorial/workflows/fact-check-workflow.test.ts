import assert from "node:assert/strict";
import test from "node:test";
import type { FactCheck, FactCheckFinding } from "@skladno/shared";

import { streamFactCheck } from "./fact-check-workflow.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import type { EditorialEngineEvent } from "../../../application/editorial/engine/editorial-engine-event.js";


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


test("checks three claims concurrently and reports each completed claim before the final result", async () => {
    const claims = ["first", "second", "third", "fourth"];
    const started: string[] = [];
    const finish = new Map<string, () => void>();
    const events: EditorialEngineEvent[] = [];
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: claims.map((claim) => ({ claim })) }),
        researchClaims: async (items) => {
            const claim = items[0]!.claim;
            started.push(claim);
            await new Promise<void>((resolve) => {
                finish.set(claim, resolve);
            });
            return [{ claim, evidence: "Evidence", sources: [] }];
        },
        evaluateClaims: async (items) => {
            const claim = items[0]!.claim;
            return { responseId: claim, findings: [{ claim, status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [] }] };
        },
    };
    const run = (async () => {
        for await (const event of streamFactCheck({ request: { article: "Article", instructions: "Check" }, signal: new AbortController().signal, provider }))
            events.push(event);
    })();

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(started, ["first", "second", "third"]);
    const checking = events.filter((event) => event.type === "tool_status" && event.claims).at(-1);
    assert.deepEqual(checking?.type === "tool_status" ? checking.claims?.map(({ claim, checking: active }) => [claim, Boolean(active)]) : [], [
        ["first", true], ["second", true], ["third", true], ["fourth", false],
    ]);
    finish.get("second")!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(events.filter((event) => event.type === "fact_check_progress").at(-1)?.factCheck.findings.map(({ claim }) => claim), ["second"]);
    finish.get("first")!();
    finish.get("third")!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(started, claims);
    finish.get("fourth")!();
    await run;
    assert.deepEqual(events.find((event) => event.type === "completed")?.factCheck?.findings.map(({ claim }) => claim), claims);
});


test("keeps finished findings when another claim fails", async () => {
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "failed" }, { claim: "checked" }] }),
        researchClaims: async ([claim]) => {
            if (claim?.claim === "failed")
                throw new Error("provider failed");

            return [{ claim: claim!.claim, evidence: "Evidence", sources: [] }];
        },
        evaluateClaims: async ([research]) => ({ responseId: "evaluated", findings: [{ claim: research!.claim, status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [] }] }),
    };
    const events: EditorialEngineEvent[] = [];
    for await (const event of streamFactCheck({ request: { article: "Article", instructions: "Check" }, signal: new AbortController().signal, provider }))
        events.push(event);

    const completed = events.find((event) => event.type === "completed");
    assert.equal(completed?.factCheck?.incomplete, true);
    assert.deepEqual(completed?.factCheck?.findings.map(({ claim }) => claim), ["checked"]);
});


test("accepts multiple findings from one claim evaluation", async () => {
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "combined claim" }] }),
        researchClaims: async () => [{ claim: "combined claim", evidence: "Evidence", sources: [] }],
        evaluateClaims: async () => ({ responseId: "evaluated", findings: ["first fact", "second fact"].map((claim) => ({ claim, status: "supported" as const, rationale: "Evidence", uncertainty: "Low", sources: [] })) }),
    };
    let completed: FactCheck | undefined;
    for await (const event of streamFactCheck({ request: { article: "Article", instructions: "Check" }, signal: new AbortController().signal, provider })) {
        if (event.type === "completed")
            completed = event.factCheck;
    }

    assert.deepEqual(completed?.findings.map(({ claim }) => claim), ["first fact", "second fact"]);
});


test("exposes extracted claims before research and skips a deselected claim", async () => {
    const skipped = new Set<string>();
    const researched: string[] = [];
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "first" }, { claim: "second" }] }),
        researchClaims: async ([item]) => {
            researched.push(item!.claim);
            return [{ claim: item!.claim, evidence: "Evidence", sources: [] }];
        },
        evaluateClaims: async ([item]) => ({ responseId: "evaluated", findings: [{ claim: item!.claim, status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [] }] }),
    };
    const stream = streamFactCheck({ request: { article: "Article", instructions: "Check", skipFactCheckClaim: (claim) => skipped.has(claim) }, signal: new AbortController().signal, provider })[Symbol.asyncIterator]();
    let preview: EditorialEngineEvent | undefined;
    while (!preview || preview.type !== "tool_status" || !preview.claims)
        preview = (await stream.next()).value;

    assert.deepEqual(preview.claims?.map(({ claim }) => claim), ["first", "second"]);
    assert.deepEqual(researched, []);
    skipped.add("first");
    let completed: FactCheck | undefined;
    for (let step = await stream.next(); !step.done; step = await stream.next()) {
        if (step.value.type === "completed")
            completed = step.value.factCheck;
    }

    assert.deepEqual(researched, ["second"]);
    assert.deepEqual(completed?.findings.map(({ claim }) => claim), ["second"]);
});


test("retains six existing claims alongside new claims omitted by extraction", async () => {
    const existing = Array.from({ length: 6 }, (_, index) => `Established fact ${index + 1}.`);
    const article = [...existing, "New fact one.", "New fact two."].join(" ");
    const previous = existing.map((claim, index) => ({ ...base, factId: `fact-${index}`, claim }));
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "New fact one." }, { claim: "New fact two." }] }),
        researchClaims: async ([item]) => [{ claim: item!.claim, evidence: "Evidence", sources: [] }],
        evaluateClaims: async ([item]) => ({ responseId: "evaluated", findings: [{ claim: item!.claim, status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [] }] }),
    };
    const previews: string[][] = [];
    let result: FactCheck | undefined;
    for await (const event of streamFactCheck({ request: { article, instructions: "Check", reusableFactFindings: previous }, signal: new AbortController().signal, provider })) {
        if (event.type === "tool_status" && event.claims)
            previews.push(event.claims.map(({ claim }) => claim));

        if (event.type === "completed")
            result = event.factCheck;
    }

    const order = [...existing, "New fact one.", "New fact two."];
    assert.deepEqual(result?.findings.map(({ claim }) => claim).sort(), [...order].sort());
    assert.ok(previews.every((claims) => claims.join("|") === order.join("|")));
});


test("restores an in-flight claim before the Assistant finishes", async () => {
    const skipped = new Set<string>();
    const finish = new Map<string, () => void>();
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "first" }, { claim: "second" }] }),
        researchClaims: async ([item]) => {
            const claim = item!.claim;
            await new Promise<void>((resolve) => finish.set(claim, resolve));
            return [{ claim, evidence: "Evidence", sources: [] }];
        },
        evaluateClaims: async ([item]) => ({ responseId: "evaluated", findings: [{ claim: item!.claim, status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [] }] }),
    };
    let completed: FactCheck | undefined;
    const run = (async () => {
        for await (const event of streamFactCheck({ request: { article: "first second", instructions: "Check", skipFactCheckClaim: (claim) => skipped.has(claim) }, signal: new AbortController().signal, provider })) {
            if (event.type === "completed")
                completed = event.factCheck;
        }
    })();

    await new Promise<void>((resolve) => setImmediate(resolve));
    skipped.add("first");
    finish.get("first")!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    skipped.delete("first");
    finish.get("second")!();
    await run;
    assert.deepEqual(completed?.findings.map(({ claim }) => claim), ["first", "second"]);
});


test("accepts only citations present in the research evidence", async () => {
    const citedUrl = "https://example.org/report";
    for (const { research, valid } of [
        { research: { evidence: "See https://example.org/report.", sources: [] }, valid: true },
        { research: { evidence: "Research summary", sources: [{ url: citedUrl }] }, valid: true },
        { research: { evidence: "Research summary", sources: [] }, valid: false },
        { research: { evidence: "See https://example.org/report-extra", sources: [] }, valid: false },
    ]) {
        const provider: FactCheckProvider = {
            researchStage: "web_research",
            extractClaims: async () => ({ responseId: "extracted", claims: [{ claim: "Claim" }] }),
            researchClaims: async () => [{ claim: "Claim", ...research }],
            evaluateClaims: async () => ({ responseId: "evaluated", findings: [{ claim: "Claim", status: "supported", rationale: "Evidence", uncertainty: "Low", sources: [{ url: citedUrl, title: "Report", excerpt: null, quality: "primary", publishedAt: null }] }] }),
        };
        const run = async () => {
            let completed = false;
            for await (const event of streamFactCheck({ request: { article: "Claim", instructions: "Check" }, signal: new AbortController().signal, provider }))
                completed ||= event.type === "completed";

            return completed;
        };

        if (valid)
            assert.equal(await run(), true);
        else
            await assert.rejects(run(), { code: "invalid_output" });
    }
});
