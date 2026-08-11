import assert from "node:assert/strict";
import test from "node:test";
import type { ProposalSummaryGenerator } from "../ports/proposal-summary-generator.js";
import { ProposalSummaryService } from "./proposal-summary-service.js";


test("summarizes validated Proposal changes through the supporting generator", async () => {
    const generator: ProposalSummaryGenerator = {
        summarize: async (changes) => changes.map((change) => ({ changeId: change.id, summary: "Clarifies the opening." })),
    };
    const service = new ProposalSummaryService({
        resolve: () => undefined,
        resolveProposalSummaryGenerator: () => generator,
    });

    const result = await service.summarize({
        changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Before"], proposalLines: ["After"] }],
    }, new AbortController().signal);

    assert.deepEqual(result, [{ changeId: "change-1", summary: "Clarifies the opening." }]);
});
