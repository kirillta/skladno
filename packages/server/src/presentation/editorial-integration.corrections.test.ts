import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD, REVISION_PROVENANCE_KIND } from "@skladno/shared";
import { EDITORIAL_ENGINE_EVENT } from "../application/editorial/engine/editorial-engine-events.js";
import { persistFactCheckArtifact } from "../application/editorial/fact-checking/persist-fact-check-artifact.js";
import { FixtureEngine, withService } from "./editorial-integration.test-utils.js";

const completion = { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "correction", text: "Corrected text." } as const;

// Product scenarios: editorial-workflows.fact-correction-proposal, editorial-workflows.finding-operations-preserve-article, history-and-publishing.fact-findings-advisory
test("verified correction selection creates one reviewable Proposal and resolves only on acceptance", async () => {
    const engine = new FixtureEngine([completion]);
    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Wrong claim." });
        const { factCheck } = persistFactCheckArtifact({
            artifacts: repositories.editorialArtifacts, factChecks: repositories.factChecks,
            articleId: article.id, revisionId: article.currentRevisionId, metadata: {},
            factCheck: { findings: [
                { claim: "Wrong claim.", status: "disputed", rationale: "Source disagrees.", uncertainty: "Low", sources: [] },
                { claim: "Other claim.", status: "unverifiable", rationale: "No source.", uncertainty: "High", sources: [] },
            ] },
        });
        const selectedId = factCheck.findings[0]!.occurrenceId!;
        const otherId = factCheck.findings[1]!.occurrenceId!;
        const correction = (ids: string[], revisionId = article.currentRevisionId) => fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST, headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: crypto.randomUUID(), operation: EDITORIAL_OPERATION.FLOW_REVISION, correctionSelection: { expectedRevisionId: revisionId, occurrenceIds: ids } }),
        });

        for (const ids of [["missing"], [selectedId, "missing"], [selectedId, selectedId], [otherId, selectedId, "missing"]]) {
            assert.match(await (await correction(ids)).text(), /"errorCode":"fact_correction_selection_invalid"/);
            assert.equal(engine.requests.length, 0);
        }

        assert.match(await (await correction([selectedId], "other-revision")).text(), /"errorCode":"fact_correction_selection_invalid"/);
        assert.equal(engine.requests.length, 0);

        const response = await correction([selectedId]);
        assert.match(await response.text(), /"type":"completed"/);
        assert.equal(engine.requests.length, 1);
        assert.match(engine.requests[0]!.authorContext, /Wrong claim\./);
        const proposal = repositories.editorialArtifacts.listEditorialArtifacts(article.id).find((artifact) => artifact.kind === "editorial-proposal")!;
        assert.deepEqual(JSON.parse(proposal.content).correctionSelection.occurrenceIds, [selectedId]);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Wrong claim.");
        assert.equal(repositories.factChecks.listFactChecks(article.id)[0]!.findings[0]!.resolution, undefined);

        const acceptance = {
            baseRevisionId: article.currentRevisionId, content: "Corrected text.",
            provenance: { kind: REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL, baseRevisionId: article.currentRevisionId, editorialArtifactId: proposal.id, wholeProposal: true },
        };
        const accepted = await fetch(`${baseUrl}/api/articles/${article.id}/proposal-acceptances`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify(acceptance) });
        assert.equal(accepted.status, 201);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Corrected text.");
        const findings = repositories.factChecks.listFactChecks(article.id)[0]!.findings;
        assert.equal(findings[0]!.resolution, "corrected_or_removed");
        assert.equal(findings[1]!.resolution, undefined);
        assert.match(await (await correction([otherId], repositories.articles.getArticle(article.id)!.currentRevisionId)).text(), /"errorCode":"fact_correction_selection_invalid"/);
        assert.match(await (await correction([selectedId])).text(), /"errorCode":"fact_correction_selection_invalid"/);
        const conflicted = await fetch(`${baseUrl}/api/articles/${article.id}/proposal-acceptances`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify(acceptance) });
        assert.equal(conflicted.status, 409);
        assert.equal(repositories.factChecks.listFactChecks(article.id)[0]!.findings[1]!.resolution, undefined);
    });
});

test("resolved selections and direct correction resolution are rejected", async () => {
    const engine = new FixtureEngine([completion]);
    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Claim." });
        const { factCheck } = persistFactCheckArtifact({ artifacts: repositories.editorialArtifacts, factChecks: repositories.factChecks,
            articleId: article.id, revisionId: article.currentRevisionId, metadata: {},
            factCheck: { findings: [{ claim: "Claim.", status: "disputed", rationale: "Contradicted.", uncertainty: "Low", sources: [] }] } });
        const id = factCheck.findings[0]!.occurrenceId!;
        repositories.factChecks.resolveFactCheckFinding(id, "accepted_as_written");
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "resolved", operation: EDITORIAL_OPERATION.FLOW_REVISION, correctionSelection: { expectedRevisionId: article.currentRevisionId, occurrenceIds: [id] } }) });
        assert.match(await response.text(), /"errorCode":"fact_correction_selection_invalid"/);
        assert.equal(engine.requests.length, 0);
        const direct = await fetch(`${baseUrl}/api/articles/${article.id}/fact-checks/${id}/resolution`, { method: HTTP_METHOD.PUT, headers: { "content-type": "application/json" }, body: JSON.stringify({ resolution: "corrected_or_removed" }) });
        assert.equal(direct.status, 400);
    });
});


test("a concurrent Revision blocks correction acceptance without resolving its Finding", async () => {
    const engine = new FixtureEngine([completion]);
    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Claim." });
        const { factCheck } = persistFactCheckArtifact({ artifacts: repositories.editorialArtifacts, factChecks: repositories.factChecks,
            articleId: article.id, revisionId: article.currentRevisionId, metadata: {},
            factCheck: { findings: [{ claim: "Claim.", status: "disputed", rationale: "Contradicted.", uncertainty: "Low", sources: [] }] } });
        const id = factCheck.findings[0]!.occurrenceId!;
        await (await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "correction", operation: EDITORIAL_OPERATION.FLOW_REVISION, correctionSelection: { expectedRevisionId: article.currentRevisionId, occurrenceIds: [id] } }) })).text();
        const proposal = repositories.editorialArtifacts.listEditorialArtifacts(article.id).find((artifact) => artifact.kind === "editorial-proposal")!;
        repositories.articles.appendArticleRevision(article.id, "Author edit.", { kind: "author_draft", baseRevisionId: article.currentRevisionId });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/proposal-acceptances`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" },
            body: JSON.stringify({ baseRevisionId: article.currentRevisionId, content: "Corrected text.", provenance: { kind: REVISION_PROVENANCE_KIND.ACCEPTED_PROPOSAL, baseRevisionId: article.currentRevisionId, editorialArtifactId: proposal.id, wholeProposal: true } }) });
        assert.equal(response.status, 409);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Author edit.");
        assert.equal(repositories.factChecks.listFactChecks(article.id)[0]!.findings[0]!.resolution, undefined);
    });
});
