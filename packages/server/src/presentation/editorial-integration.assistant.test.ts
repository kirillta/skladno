import assert from "node:assert/strict";
import test from "node:test";
import { HTTP_METHOD } from "@skladno/shared";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/ports/editorial-engine-event.js";
import type { AssistantActionIntentVerifier } from "../application/ports/assistant-action-intent-verifier.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../application/ports/editorial-engine-error.js";
import { CapabilityFixtureEngine, FixtureEngine, noConversation, withService } from "./editorial-integration.test-utils.js";

// Product scenarios: editorial-workflows.assistant-request-proposal, editorial-workflows.proposal-operations-remain-separate
test("assistant requests persist a revision-bound proposal and splice only the selected Markdown", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "improved" },
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-flow", text: "improved" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "before selected after" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-request-1",
                authorMessage: "Improve the flow of this selection.",
                scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 7, endOffset: 15 },
            }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.list(article.id)[0]!;

        assert.match(body, /"type":"accepted"/);
        assert.match(body, /"type":"skill_resolved".*"skillId":"flow_and_clarity"/);
        assert.match(body, /"type":"capability_activity".*"summary":"Preparing a Proposal\.".*"status":"started"/);
        assert.match(body, /"type":"capability_activity".*"summary":"Preparing a Proposal\.".*"status":"completed"/);
        assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
        assert.equal(engine.requests[0]?.article, "selected");
        assert.equal(engine.requests[0]?.articleSelection, true);
        assert.equal(JSON.parse(artifact.content).proposal, "before improved after");
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "before selected after");
        assert.equal(repositories.assistant.getRequest("assistant-request-1")?.status, "completed");
        assert.equal(repositories.assistant.listMessages(article.id).filter((message) => message.requestId === "assistant-request-1").length, 2);
        assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.role === "author")?.selectionText, "selected");
        const proposalMessage = repositories.assistant.listMessages(article.id).find((message) => message.requestId === "assistant-request-1" && message.role === "assistant");
        assert.equal(proposalMessage?.proposalContent, "before improved after");
        assert.equal(proposalMessage?.baseRevisionId, article.currentRevisionId);
        assert.equal(proposalMessage?.baseRevisionContent, "before selected after");
    });
});


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
        const artifact = repositories.editorialArtifacts.list(article.id)[0]!;

        assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
        assert.equal(JSON.parse(artifact.content).capability, "generate_proposal");
        assert.equal(JSON.parse(artifact.content).proposal, "Improved Article");
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "Original Article");
    });
});


test("the live Assistant routes a plain-language translation request through the Translation tool", async () => {
    const engine = new CapabilityFixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "catalog-translation",
        text: "Artículo traducido",
        translation: { targetLanguage: "Spanish", protectedSpans: [] },
    }], "translate", { targetLanguage: "Spanish" }, "translate");

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-tool-translation", authorMessage: "Translate the Article into Spanish.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();

        assert.match(body, /"skillId":"translation".*"source":"inferred"/);
        assert.match(body, /"responseKind":"translation_proposal_prepared"/);
        assert.equal(JSON.parse(repositories.editorialArtifacts.list(article.id)[0]!.content).capability, "translate");
    });
});


test("the live Assistant tool loop runs no-input artifact capabilities", async () => {
    const engine = new CapabilityFixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "catalog-fact-check",
        text: "",
        factCheck: { findings: [{ claim: "A claim", status: "unverifiable", rationale: "No source.", uncertainty: "Unknown.", sources: [] }] },
    }], "fact_check");

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "A claim" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-tool-fact", authorMessage: "Check this fact.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();

        assert.match(body, /"summary":"Checking facts\."/);
        assert.match(body, /"type":"staged_completion"/);
        assert.match(body, /"responseKind":"findings_prepared"/);
        assert.equal(repositories.editorialArtifacts.list(article.id)[0]?.kind, "fact-check");
        assert.equal(repositories.assistant.getRequest("assistant-tool-fact")?.execution?.capability, "fact_check");
    });
});


test("the live Assistant authorizes an exact metadata action in the Author's language", async () => {
    const engine = new CapabilityFixtureEngine([], "rename_article", { title: "Crónica del Río" });
    const verifier: AssistantActionIntentVerifier = {
        verify: async (message, capability, input) => message === "Renombra el artículo a Crónica del Río" && capability === "rename_article" && input.title === "Crónica del Río",
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-spanish-rename", authorMessage: "Renombra el artículo a Crónica del Río", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.equal(response.status, 200);
        assert.equal(repositories.articles.get(article.id)?.title, "Crónica del Río");

        const rejectedArticle = repositories.articleService.createArticle({ title: "Keep this", content: "Original Article" });
        await fetch(`${baseUrl}/api/articles/${rejectedArticle.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-rejected-rename", authorMessage: "No renombres el artículo", scope: { kind: "article", baseRevisionId: rejectedArticle.currentRevisionId } }),
        });
        assert.equal(repositories.articles.get(rejectedArticle.id)?.title, "Keep this");
    }, true, verifier);
});


test("Assistant HTTP accepts a legacy Editorial operation without persisting its legacy ID", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "legacy-flow", text: "Improved" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "legacy-flow-request",
                authorMessage: "Improve the flow.",
                explicitSkillId: "flow_revision",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.match(await response.text(), /"skillId":"flow_and_clarity"/);
        assert.equal(repositories.assistant.getRequest("legacy-flow-request")?.explicitSkillId, "flow_and_clarity");
    });
});


test("Narrative Draft without guidance uses the whole Article and its selected character limit", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-whole-article", text: "improved Article" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "The whole Article", publishingProfileId: "default" });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-whole-article",
                authorMessage: "",
                explicitSkillId: "narrative_draft",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.equal(engine.requests[0]?.article, "The whole Article");
        assert.equal(engine.requests[0]?.authorContext, "");
        assert.equal(engine.requests[0]?.skillId, "narrative_draft");
        assert.equal(engine.requests[0]?.targetArticleCharacterLimit, 3_000);
    });
});


test("conversational Assistant requests send only the selected Article context", async () => {
    let conversation: { article: string; scope: "article" | "selection" } | undefined;
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            return;
        },
        async *streamConversation(request): AsyncIterable<EditorialEngineEvent> {
            conversation = { article: request.article, scope: request.scope };
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "conversation-selection", text: "I received the selected text." };
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "before selected after" });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-conversation-selection",
                authorMessage: "What did I send?",
                scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 7, endOffset: 15 },
            }),
        });

        assert.deepEqual(conversation, { article: "selected", scope: "selection" });
    });
});


test("assistant streams include a stable failure code", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new EditorialEngineError("network", "OpenAI could not be reached. Check your connection and API settings, then retry.");
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-request-error",
                authorMessage: "Improve the flow.",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.match(await response.text(), /"errorCode":"editorial_provider_failed"/);
    });
});
