import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD, type FactCheckFinding } from "@skladno/shared";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import { streamFactCheck, type FactCheckFindingDraft, type FactCheckProvider } from "../infrastructure/editorial/fact-check-workflow.js";
import { FixtureEngine, withService } from "./editorial-integration.test-utils.js";

// Product scenarios: workspace.findings.advisory-only, editorial-workflows.finding-operations-preserve-article, history-and-publishing.fact-findings-advisory
test("fact checks persist completed findings and citations against the reviewed Revision", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "claim_extraction", status: "started" },
        {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: "fact-check-complete",
            text: "",
            factCheck: {
                findings: [
                    {
                        claim: "HTTP was standardized in 1999.",
                        status: "supported",
                        rationale: "The cited RFC records the publication date.",
                        uncertainty: "The source is primary and dated.",
                        sources: [{ url: "https://www.rfc-editor.org/rfc/rfc2616", title: "RFC 2616", quality: "primary", publishedAt: "1999-06" }],
                    },
                    {
                        claim: "Every API uses HTTP.",
                        status: "unverifiable",
                        rationale: "No evidence was found for this universal claim.",
                        uncertainty: "Absence of evidence is not support.",
                        sources: [],
                    },
                ],
            },
        },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "An article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "fact-request", operation: EDITORIAL_OPERATION.FACT_CHECK }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.list(article.id)[0]!;

        assert.match(body, /"type":"tool_status","tool":"claim_extraction"/);
        assert.match(body, /"status":"unverifiable"/);
        assert.equal(artifact.kind, "fact-check");
        assert.equal(artifact.revisionId, article.currentRevisionId);
        assert.equal(repositories.editorialArtifacts.listCitations(artifact.id)[0]?.url, "https://www.rfc-editor.org/rfc/rfc2616");
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "An article");
    });
});


test("Assistant Fact Check results persist revision-bound findings for review", async () => {
    const engine = new FixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS,
        tool: "claim_extraction",
        status: "completed",
        claims: [{ claim: "HTTP was standardized in 1999.", checked: false }],
    }, {
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "assistant-fact-check-complete",
        text: "",
        factCheck: {
            findings: [{
                claim: "HTTP was standardized in 1999.",
                status: "disputed",
                rationale: "The RFC date differs from the claim.",
                uncertainty: "The cited source is primary.",
                sources: [{ url: "https://www.rfc-editor.org/rfc/rfc2616", title: "RFC 2616", quality: "primary", publishedAt: "1999-06" }],
            }]
        },
    }]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "An article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-fact-request", authorMessage: "", explicitSkillId: "fact_checking", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();
        const checks = await (await fetch(`${baseUrl}/api/articles/${article.id}/fact-checks`)).json() as { reviewedRevisionId: string; findings: { occurrenceId?: string }[] }[];
        const artifact = repositories.editorialArtifacts.list(article.id)[0]!;

        assert.match(body, /"claims":\[{"claim":"HTTP was standardized in 1999\.","checked":false}\]/);
        assert.match(body, /"reviewedRevisionId":"[^"]+"/);
        assert.equal(checks[0]?.reviewedRevisionId, article.currentRevisionId);
        assert.ok(checks[0]?.findings[0]?.occurrenceId);
        assert.equal(repositories.editorialArtifacts.listCitations(artifact.id)[0]?.url, "https://www.rfc-editor.org/rfc/rfc2616");
    });
});


test("Assistant Fact Check reuses an unchanged supported claim without researching it again", async () => {
    let researchCalls = 0;
    const finding: FactCheckFinding = { claim: "HTTP was standardized in 1999.", status: "supported", rationale: "RFC 2616 records the date.", uncertainty: "Primary source.", sources: [] };
    const evaluatedFinding: FactCheckFindingDraft = { ...finding, sources: [] };
    const provider: FactCheckProvider = {
        researchStage: "web_research",
        extractClaims: async () => ({ responseId: "claim-extraction", claims: [{ claim: finding.claim }] }),
        researchClaims: async (claims) => {
            researchCalls++;
            return claims.map((claim) => ({ ...claim, evidence: "RFC 2616", sources: [] }));
        },

        evaluateClaims: async () => ({ responseId: "evaluation", findings: [evaluatedFinding] }),
    };

    const engine: EditorialEngine = {
        async *stream(request, signal) {
            yield* streamFactCheck({ request: { article: request.article, reusableFactFindings: request.reusableFactFindings }, signal, provider });
        },
        async *streamConversation() {
            return;
        },
        async *streamAssistant(request, signal) {
            const factCheck = request.tools.find((tool) => tool.capability === "fact_check");
            assert.ok(factCheck);
            await factCheck.execute({}, signal);

            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-fact-check", text: "" };
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: finding.claim });
        await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "first-fact-check", operation: EDITORIAL_OPERATION.FACT_CHECK }),
        });
        assert.equal(researchCalls, 1);

        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "reused-fact-check", authorMessage: "", explicitSkillId: "fact_checking", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.equal(response.status, 200);
        assert.equal(researchCalls, 1);
    });
});
