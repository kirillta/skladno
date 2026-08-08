import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD } from "@skladno/shared";

// Product scenarios: workspace.findings.advisory-only, editorial-workflows.assistant-request-proposal, editorial-workflows.assistant-stream-failure-safe, editorial-workflows.proposal-operations-remain-separate, editorial-workflows.finding-operations-preserve-article, editorial-workflows.translation-preserves-source, history-and-publishing.fact-findings-advisory

import { EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngine, type EditorialEngineEvent, type EditorialEngineRequest } from "./editorial/editorial-engine.js";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";


async function* noConversation(): AsyncIterable<EditorialEngineEvent> {
    return;
}


class FixtureEngine implements EditorialEngine {
    requests: EditorialEngineRequest[] = [];

    constructor(private readonly events: EditorialEngineEvent[]) { }

    async *stream(request: EditorialEngineRequest): AsyncIterable<EditorialEngineEvent> {
        this.requests.push(request);
        yield* this.events;
    }


    async *streamConversation(): AsyncIterable<EditorialEngineEvent> {
        yield* noConversation();
    }
}


async function withService(engine: EditorialEngine, run: (baseUrl: string, repositories: Repositories) => Promise<void>, storeResponses = true): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), "skladno-editorial-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = new Repositories(database);

    const service = createLocalService({ host: "127.0.0.1", port: 0, webOrigin: "http://localhost:5173", databasePath: "unused", openAiModel: "gpt-5", openAiStoreResponses: storeResponses }, repositories, engine);
    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");

    try {
        await run(`http://127.0.0.1:${address.port}`, repositories);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}


test("editorial endpoint streams a typed proposal and saves context only after completion", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "A " },
        { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "web_search", status: "started" },
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "proposal" },
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "resp-1", text: "A proposal" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-1", operation: EDITORIAL_OPERATION.FLOW_REVISION, authorContext: "Keep the direct tone." }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta","delta":"A "/);
        assert.match(body, /"type":"completed","responseId":"resp-1","text":"A proposal"/);
        assert.equal(repositories.getEditorialSession(article.id)?.previousResponseId, "resp-1");
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "Original article");
        assert.equal(engine.requests[0]?.article, "Original article");
        assert.equal(engine.requests[0]?.operation, EDITORIAL_OPERATION.FLOW_REVISION);
        assert.equal(engine.requests[0]?.authorContext, "Keep the direct tone.");
        assert.deepEqual(JSON.parse(repositories.listEditorialArtifacts(article.id)[0]!.content), {
            requestId: "request-1",
            operation: EDITORIAL_OPERATION.FLOW_REVISION,
            authorContext: "Keep the direct tone.",
            responseId: "resp-1",
            proposal: "A proposal",
        });
    });
});


test("failed or incomplete editorial streams leave the Article and session unchanged", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" }]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-2", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta"/);
        assert.match(body, /"type":"error","requestId":"request-2","code":"malformed_stream"/);
        assert.equal(repositories.getEditorialSession(article.id), undefined);
        assert.deepEqual(repositories.listEditorialArtifacts(article.id), []);
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "Original article");
    });
});


test("storage-disabled editorial requests clear hidden session continuation", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "resp-stateless", text: "A proposal" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        repositories.saveEditorialSession(article.id, "resp-old");

        await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-stateless", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.equal(engine.requests[0]?.previousResponseId, undefined);
        assert.equal(repositories.getEditorialSession(article.id), undefined);
    }, false);
});


test("expired provider session is cleared and can be retried as a fresh session", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new EditorialEngineError("session_expired", "The saved editorial session is no longer available. Retry to start a fresh session.");
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        repositories.saveEditorialSession(article.id, "resp-expired");
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-expired", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.match(await response.text(), /"code":"session_expired"/);
        assert.equal(repositories.getEditorialSession(article.id), undefined);
    });
});


test("provider errors are actionable and leave the article unchanged", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new Error("OpenAI could not complete this request (429). Check your connection and API settings, then retry.");
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-provider-error", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"error","requestId":"request-provider-error","code":"network"/);
        assert.match(body, /"errorCode":"editorial_provider_failed"/);
        assert.equal(repositories.getEditorialSession(article.id), undefined);
        assert.deepEqual(repositories.listEditorialArtifacts(article.id), []);
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "Original article");
    });
});


test("cancelling an editorial stream does not change the article or session", async () => {
    const engine: EditorialEngine = {
        async *stream(_request, signal): AsyncIterable<EditorialEngineEvent> {
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" };
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
        const controller = new AbortController();
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-3", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
            signal: controller.signal,
        });

        const reader = response.body!.getReader();
        await reader.read();
        controller.abort();

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(repositories.getEditorialSession(article.id), undefined);
        assert.deepEqual(repositories.listEditorialArtifacts(article.id), []);
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "Original article");
    });
});


test("style review uses a compact local profile and saves cited findings as a proposal", async () => {
    const engine = new FixtureEngine([
        {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: "resp-style-1",
            text: "A concise proposal.",
            styleReview: {
                findings: [{
                    divergence: "The draft uses long paragraphs.",
                    suggestion: "Split the opening paragraph.",
                    traitIds: ["paragraphing"],
                }],
            },
        },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        repositories.addStyleCorpusItem({ name: "Published sample", content: "I write short sentences.\n\nI keep paragraphs brief." });
        const article = repositories.createArticle({ title: "Draft", content: "A long draft" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "style-request", operation: EDITORIAL_OPERATION.STYLE_REVIEW }),
        });
        const body = await response.text();
        const artifact = repositories.listEditorialArtifacts(article.id)[0]!;

        assert.match(body, /"text":"A concise proposal."/);
        assert.match(body, /"traitIds":\["paragraphing"\]/);
        assert.equal(engine.requests[0]!.styleProfile?.traits.some((trait) => trait.id === "paragraphing"), true);
        assert.deepEqual(JSON.parse(artifact.content).findings, [{
            divergence: "The draft uses long paragraphs.",
            suggestion: "Split the opening paragraph.",
            traitIds: ["paragraphing"],
        }]);
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "A long draft");
    });
});


test("translation carries its target language, preserves the source, and records review metadata", async () => {
    const engine = new FixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "translation-1",
        text: "Ejecuta `npm test` en https://example.com.",
        translation: {
            targetLanguage: "Spanish",
            protectedSpans: ["`npm test`", "https://example.com"],
        },
    }]);

    await withService(engine, async (baseUrl, repositories) => {
        const source = repositories.createArticle({ title: "Source", content: "Run `npm test` at https://example.com." });
        const response = await fetch(`${baseUrl}/api/articles/${source.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "translation-request", operation: EDITORIAL_OPERATION.TRANSLATION, targetLanguage: "Spanish" }),
        });
        const body = await response.text();
        const artifact = repositories.listEditorialArtifacts(source.id)[0]!;
        const translated = repositories.createArticle({
            title: "Source — Spanish",
            content: "Ejecuta `npm test` en https://example.com.",
            language: "es",
            sourceArticleId: source.id,
            sourceRevisionId: source.currentRevisionId,
            provenance: { kind: "accepted-translation", targetLanguage: "Spanish" },
        });

        assert.match(body, /"targetLanguage":"Spanish"/);
        assert.equal(engine.requests[0]?.targetLanguage, "Spanish");
        assert.equal(repositories.getArticle(source.id)?.currentRevision.content, "Run `npm test` at https://example.com.");
        assert.deepEqual(JSON.parse(artifact.content).translation, {
            targetLanguage: "Spanish",
            protectedSpans: ["`npm test`", "https://example.com"],
        });
        assert.equal(translated.language, "es");
        assert.equal(translated.sourceArticleId, source.id);
        assert.equal(repositories.restoreRevision(translated.id, translated.currentRevisionId).content, translated.currentRevision.content);
    });
});


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
        const article = repositories.createArticle({ title: "Draft", content: "An article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "fact-request", operation: EDITORIAL_OPERATION.FACT_CHECK }),
        });
        const body = await response.text();
        const artifact = repositories.listEditorialArtifacts(article.id)[0]!;

        assert.match(body, /"type":"tool_status","tool":"claim_extraction"/);
        assert.match(body, /"status":"unverifiable"/);
        assert.equal(artifact.kind, "fact-check");
        assert.equal(artifact.revisionId, article.currentRevisionId);
        assert.equal(repositories.listSourceCitations(artifact.id)[0]?.url, "https://www.rfc-editor.org/rfc/rfc2616");
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "An article");
    });
});


test("assistant requests persist a revision-bound proposal and splice only the selected Markdown", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "improved" },
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-flow", text: "improved" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.createArticle({ title: "Draft", content: "before selected after" });
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
        const artifact = repositories.listEditorialArtifacts(article.id)[0]!;

        assert.match(body, /"type":"accepted"/);
        assert.match(body, /"type":"skill_resolved".*"skillId":"flow_and_clarity"/);
        assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
        assert.equal(engine.requests[0]?.article, "selected");
        assert.equal(JSON.parse(artifact.content).proposal, "before improved after");
        assert.equal(repositories.getArticle(article.id)?.currentRevision.content, "before selected after");
        assert.equal(repositories.assistant.getRequest("assistant-request-1")?.status, "completed");
        assert.equal(repositories.listAssistantMessages(article.id).filter((message) => message.requestId === "assistant-request-1").length, 2);
        assert.equal(repositories.listAssistantMessages(article.id).find((message) => message.role === "author")?.selectionText, "selected");
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
        const article = repositories.createArticle({ title: "Draft", content: "before selected after" });
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
        const article = repositories.createArticle({ title: "Draft", content: "Original article" });
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
