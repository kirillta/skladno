import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { HTTP_METHOD } from "@skladno/shared";

import type { EditorialProvider, EditorialProviderRequest, ProviderStreamEvent } from "./editorial/openai-responses-provider.js";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";


class FixtureProvider implements EditorialProvider {
    requests: EditorialProviderRequest[] = [];

    constructor(private readonly events: ProviderStreamEvent[]) { }

    async *stream(request: EditorialProviderRequest): AsyncIterable<ProviderStreamEvent> {
        this.requests.push(request);
        yield* this.events;
    }
}


async function withService(provider: EditorialProvider, run: (baseUrl: string, repositories: Repositories) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), "skladno-editorial-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = new Repositories(database);
    
    const service = createLocalService({ host: "127.0.0.1", port: 0, webOrigin: "http://localhost:5173", databasePath: "unused", openAiModel: "gpt-5" }, repositories, provider);
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
    const provider = new FixtureProvider([
        { type: "text_delta", delta: "A " },
        { type: "tool_status", tool: "web_search", status: "started" },
        { type: "text_delta", delta: "proposal" },
        { type: "completed", responseId: "resp-1", text: "A proposal" },
    ]);

    await withService(provider, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-1", prompt: "Improve the flow" }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta","delta":"A "/);
        assert.match(body, /"type":"completed","responseId":"resp-1","text":"A proposal"/);
        assert.equal(repositories.getEditorialSession(document.id)?.previousResponseId, "resp-1");
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
        assert.equal(provider.requests[0]?.article, "Original article");
    });
});


test("failed or incomplete editorial streams leave document and session unchanged", async () => {
    const provider = new FixtureProvider([{ type: "text_delta", delta: "Partial" }]);

    await withService(provider, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-2", prompt: "Improve the flow" }),
        });
        const body = await response.text();

        assert.match(body, /"type":"text_delta"/);
        assert.match(body, /"type":"error","requestId":"request-2","code":"malformed_stream"/);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
    });
});


test("provider errors are actionable and leave the article unchanged", async () => {
    const provider: EditorialProvider = {
        async *stream(): AsyncIterable<ProviderStreamEvent> {
            throw new Error("OpenAI could not complete this request (429). Check your connection and API settings, then retry.");
        },
    };

    await withService(provider, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-provider-error", prompt: "Improve the flow" }),
        });
        const body = await response.text();

        assert.match(body, /"type":"error","requestId":"request-provider-error","code":"network"/);
        assert.match(body, /Check your connection and API settings, then retry/);
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
    });
});


test("cancelling an editorial stream does not change the article or session", async () => {
    const provider: EditorialProvider = {
        async *stream(_request, signal): AsyncIterable<ProviderStreamEvent> {
            yield { type: "text_delta", delta: "Partial" };
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
    };

    await withService(provider, async (baseUrl, repositories) => {
        const document = repositories.createDocument({ title: "Draft", content: "Original article" });
        const controller = new AbortController();
        const response = await fetch(`${baseUrl}/api/documents/${document.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "request-3", prompt: "Improve the flow" }),
            signal: controller.signal,
        });
        
        const reader = response.body!.getReader();
        await reader.read();
        controller.abort();

        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(repositories.getEditorialSession(document.id), undefined);
        assert.equal(repositories.getDocument(document.id)?.currentVersion.content, "Original article");
    });
});
