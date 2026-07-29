import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD } from "@skladno/shared";

import { EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngine, type EditorialEngineEvent, type EditorialEngineRequest } from "./editorial/editorial-engine.js";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";


class FixtureEngine implements EditorialEngine {
    requests: EditorialEngineRequest[] = [];

    constructor(private readonly events: EditorialEngineEvent[]) { }

    async *stream(request: EditorialEngineRequest): AsyncIterable<EditorialEngineEvent> {
        this.requests.push(request);
        yield* this.events;
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
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-1", operation: EDITORIAL_OPERATION.FLOW_REVISION, authorContext: "Keep the direct tone." }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta","delta":"A "/);
        assert.match(body, /"type":"completed","responseId":"resp-1","text":"A proposal"/);
        assert.equal(repositories.getEditorialSession(document.id)?.previousResponseId, "resp-1");
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
        assert.equal(engine.requests[0]?.article, "Original article");
        assert.equal(engine.requests[0]?.operation, EDITORIAL_OPERATION.FLOW_REVISION);
        assert.equal(engine.requests[0]?.authorContext, "Keep the direct tone.");
        assert.deepEqual(JSON.parse(repositories.listWorkflowArtifacts(document.id)[0]!.content), {
            requestId: "request-1",
            operation: EDITORIAL_OPERATION.FLOW_REVISION,
            authorContext: "Keep the direct tone.",
            responseId: "resp-1",
            proposal: "A proposal",
        });
    });
});


test("failed or incomplete editorial streams leave document and session unchanged", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" }]);

    await withService(engine, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-2", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta"/);
        assert.match(body, /"type":"error","requestId":"request-2","code":"malformed_stream"/);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.deepEqual(repositories.listWorkflowArtifacts(document.id), []);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
    });
});


test("storage-disabled editorial requests clear hidden session continuation", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "resp-stateless", text: "A proposal" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        repositories.saveEditorialSession(document.id, "resp-old");

        await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-stateless", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.equal(engine.requests[0]?.previousResponseId, undefined);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
    }, false);
});


test("expired provider session is cleared and can be retried as a fresh session", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new EditorialEngineError("session_expired", "The saved editorial session is no longer available. Retry to start a fresh session.");
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        repositories.saveEditorialSession(document.id, "resp-expired");
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-expired", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });

        assert.match(await response.text(), /"code":"session_expired"/);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
    });
});


test("provider errors are actionable and leave the article unchanged", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new Error("OpenAI could not complete this request (429). Check your connection and API settings, then retry.");
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-provider-error", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
        const body = await response.text();

        assert.match(body, /"type":"error","requestId":"request-provider-error","code":"network"/);
        assert.match(body, /Check your connection and API settings, then retry/);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.deepEqual(repositories.listWorkflowArtifacts(document.id), []);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
    });
});


test("cancelling an editorial stream does not change the article or session", async () => {
    const engine: EditorialEngine = {
        async *stream(_request, signal): AsyncIterable<EditorialEngineEvent> {
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" };
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const controller = new AbortController();
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-3", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
            signal: controller.signal,
        });
        
        const reader = response.body!.getReader();
        await reader.read();
        controller.abort();

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.deepEqual(repositories.listWorkflowArtifacts(document.id), []);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
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
        const document = repositories.createDocument({ title: "Draft", content: "A long draft" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "style-request", operation: EDITORIAL_OPERATION.STYLE_REVIEW }),
        });
        const body = await response.text();
        const artifact = repositories.listWorkflowArtifacts(document.id)[0]!;

        assert.match(body, /"text":"A concise proposal."/);
        assert.match(body, /"traitIds":\["paragraphing"\]/);
        assert.equal(engine.requests[0]!.styleProfile?.traits.some((trait) => trait.id === "paragraphing"), true);
        assert.deepEqual(JSON.parse(artifact.content).findings, [{
            divergence: "The draft uses long paragraphs.",
            suggestion: "Split the opening paragraph.",
            traitIds: ["paragraphing"],
        }]);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "A long draft");
    });
});
