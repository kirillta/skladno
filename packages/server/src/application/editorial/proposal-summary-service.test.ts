import assert from "node:assert/strict";
import test from "node:test";
import type { ProposalSummaryGenerator } from "../ports/proposal-summary-generator.js";
import { ProposalSummaryService } from "./proposal-summary-service.js";


test("summarizes validated Proposal changes through the supporting generator", async () => {
    let generations = 0;
    const generator: ProposalSummaryGenerator = {
        summarize: async (changes, locale) => {
            generations += 1;

            return changes.map((change) => ({ changeId: change.id, summary: `${locale}: Clarifies the opening.` }));
        },
    };
    let content = JSON.stringify({ proposal: "After" });
    const service = new ProposalSummaryService({
        resolve: () => undefined,
        resolveProposalSummaryGenerator: () => generator,
    }, {
        get: () => ({ content }),
        updateContent: (_artifactId, _articleId, value) => {
            content = value;
        },
    });

    const result = await service.summarize("article-1", {
        editorialArtifactId: "artifact-1",
        interfaceLocale: "en",
        changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Before"], proposalLines: ["After"] }],
    }, new AbortController().signal);

    assert.deepEqual(result, [{ changeId: "change-1", summary: "en: Clarifies the opening." }]);
    assert.deepEqual(JSON.parse(content).proposalSummaries, result);
    assert.equal(JSON.parse(content).proposalSummaryLocale, "en");

    const cached = await service.summarize("article-1", {
        editorialArtifactId: "artifact-1",
        interfaceLocale: "en",
        changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Before"], proposalLines: ["After"] }],
    }, new AbortController().signal);

    assert.deepEqual(cached, result);
    assert.equal(generations, 1);
});
