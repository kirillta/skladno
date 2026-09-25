import assert from "node:assert/strict";
import test from "node:test";
import { HTTP_METHOD } from "@skladno/shared";
import { EDITORIAL_ENGINE_EVENT } from "../application/editorial/engine/editorial-engine-events.js";
import { CapabilityFixtureEngine, withService } from "./editorial-integration.test-utils.js";

test("the live Assistant tool loop stages one catalog Proposal before completion", async () => {
    const engine = new CapabilityFixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "catalog-proposal", text: "Improved Article" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-tool-loop-request",
                authorMessage: "Improve the flow.",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]!;

        assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
        assert.equal(JSON.parse(artifact.content).capability, "generate_proposal");
        assert.equal(JSON.parse(artifact.content).proposal, "Improved Article");
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Original Article");
    });
});

test("proposal Skills create revision-bound Proposals and review handoffs", async () => {
    for (const skillId of ["talking_points", "narrative_draft", "flow_and_clarity"]) {
        const engine = new CapabilityFixtureEngine([
            { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: skillId, text: `Proposal from ${skillId}` },
        ], "generate_proposal", { operation: skillId === "flow_and_clarity" ? "flow_revision" : "thesis_to_narrative" }, "generate_proposal");

        await withService(engine, async (baseUrl, repositories) => {
            const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
            const requestId = `assistant-${skillId}`;
            const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
                method: HTTP_METHOD.POST,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ requestId, authorMessage: "", explicitSkillId: skillId, scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
            });
            const body = await response.text();
            const artifact = repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]!;
            const message = repositories.assistant.listMessages(article.id).find((item) => item.requestId === requestId && item.role === "assistant");

            assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
            assert.equal(JSON.parse(artifact.content).proposal, `Proposal from ${skillId}`);
            assert.equal(artifact.revisionId, article.currentRevisionId);
            assert.equal(message?.responseKind, "proposal_prepared");
            assert.equal(message?.editorialArtifactId, artifact.id);
            assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Original Article");
        });
    }
});
