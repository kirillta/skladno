import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD } from "@skladno/shared";
import type { EditorialEngine } from "../application/services/editorial/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/models/editorial/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/models/editorial/editorial-engine-events.js";
import { EditorialEngineError } from "../application/errors/editorial-engine-error.js";
import { FixtureEngine, noConversation, withService } from "./editorial-integration.test-utils.js";

// Product scenarios: editorial-workflows.assistant-stream-failure-safe
test("editorial endpoint streams a typed proposal and saves context only after completion", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "A " },
        { type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS, tool: "web_search", status: "started" },
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "proposal" },
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "local-1", continuationToken: "resp-1", text: "A proposal" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-1", operation: EDITORIAL_OPERATION.FLOW_REVISION, authorContext: "Keep the direct tone." }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta","delta":"A "/);
        assert.match(body, /"type":"completed","responseId":"local-1","continuationToken":"resp-1","text":"A proposal"/);
        assert.equal(repositories.editorialSessions.get(article.id)?.continuationToken, "resp-1");
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "Original article");
        assert.equal(engine.requests[0]?.article, "Original article");
        assert.equal(engine.requests[0]?.operation, EDITORIAL_OPERATION.FLOW_REVISION);
        assert.equal(engine.requests[0]?.authorContext, "Keep the direct tone.");
        assert.deepEqual(JSON.parse(repositories.editorialArtifacts.list(article.id)[0]!.content), {
            requestId: "request-1",
            operation: EDITORIAL_OPERATION.FLOW_REVISION,
            authorContext: "Keep the direct tone.",
            responseId: "local-1",
            proposal: "A proposal",
        });
    });
});


test("failed or incomplete editorial streams leave the Article and session unchanged", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" }]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-2", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta"/);
        assert.match(body, /"type":"error","requestId":"request-2","code":"malformed_stream"/);
        assert.equal(repositories.editorialSessions.get(article.id), undefined);
        assert.deepEqual(repositories.editorialArtifacts.list(article.id), []);
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "Original article");
    });
});


test("an unavailable model capability is a configuration error before Article content is sent", async () => {
    await withService(undefined, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Private article content" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "unavailable-capability", operation: EDITORIAL_OPERATION.FACT_CHECK }),
        });

        assert.match(await response.text(), /"code":"configuration","errorCode":"editorial_configuration_missing","retryable":true/);
        assert.deepEqual(repositories.editorialArtifacts.list(article.id), []);
    });
});


test("storage-disabled editorial requests clear hidden session continuation", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "resp-stateless", text: "A proposal" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        repositories.editorialSessions.save(article.id, { continuationToken: "resp-old", connectionId: "connection-1", provider: "openai", model: "gpt-5" });

        await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-stateless", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.equal(engine.requests[0]?.previousResponseId, undefined);
        assert.equal(repositories.editorialSessions.get(article.id), undefined);
    }, false);
});


test("editorial continuation stays within its Article", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "local-new", continuationToken: "resp-new", text: "A proposal" }]);

    await withService(engine, async (baseUrl, repositories) => {
        const firstArticle = repositories.articleService.createArticle({ title: "First", content: "First Article" });
        const secondArticle = repositories.articleService.createArticle({ title: "Second", content: "Second Article" });
        repositories.editorialSessions.save(firstArticle.id, { continuationToken: "resp-first", connectionId: "connection-1", provider: "openai", model: "gpt-5" });

        for (const [article, requestId] of [[firstArticle, "request-first"], [secondArticle, "request-second"]] as const) {
            await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
                method: HTTP_METHOD.POST,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ requestId, operation: EDITORIAL_OPERATION.FLOW_REVISION }),
            });
        }

        assert.equal(engine.requests[0]?.previousResponseId, "resp-first");
        assert.equal(engine.requests[1]?.previousResponseId, undefined);
    });
});


test("expired provider session is cleared and can be retried as a fresh session", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new EditorialEngineError("session_expired", "The saved editorial session is no longer available. Retry to start a fresh session.");
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        repositories.editorialSessions.save(article.id, { continuationToken: "resp-expired", connectionId: "connection-1", provider: "openai", model: "gpt-5" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-expired", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.match(await response.text(), /"code":"session_expired"/);
        assert.equal(repositories.editorialSessions.get(article.id), undefined);
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
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-provider-error", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"error","requestId":"request-provider-error","code":"network"/);
        assert.match(body, /"errorCode":"editorial_provider_failed"/);
        assert.equal(repositories.editorialSessions.get(article.id), undefined);
        assert.deepEqual(repositories.editorialArtifacts.list(article.id), []);
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "Original article");
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
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
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
        assert.equal(repositories.editorialSessions.get(article.id), undefined);
        assert.deepEqual(repositories.editorialArtifacts.list(article.id), []);
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "Original article");
    });
});


