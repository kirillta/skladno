import assert from "node:assert/strict";
import test from "node:test";

import { AI_PROVIDER, type AiConnection, type AiProvider } from "@skladno/shared";

import { editorialModels, listAvailableModels } from "./available-models.js";


test("lists current editorial model variants", () => {
    assert.deepEqual(editorialModels(["babbage-002", "gpt-5.5", "gpt-5.5-mini", "gpt-5.6-luna", "gpt-image-1"]), ["gpt-5.5", "gpt-5.5-mini", "gpt-5.6-luna"]);
});


function connection(provider: AiProvider): AiConnection {
    return { id: "connection", provider, label: provider, credentialSource: { kind: "managed" }, status: "connected" };
}


test("uses each provider's documented model endpoint and authentication", async () => {
    const requests: { url: string; headers: Headers }[] = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
        requests.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response(JSON.stringify({ data: [{ id: "model-b" }, { id: "model-a" }] }), { status: 200 });
    };

    for (const provider of Object.values(AI_PROVIDER))
        await listAvailableModels(connection(provider), "secret", fetchImplementation);

    assert.deepEqual(requests.map((request) => request.url), [
        "https://api.openai.com/v1/models",
        "https://opencode.ai/zen/v1/models",
        "https://api.anthropic.com/v1/models?limit=1000",
        "https://generativelanguage.googleapis.com/v1beta/models",
        "https://api.x.ai/v1/models",
        "https://api.deepseek.com/models",
    ]);
    assert.equal(requests[2].headers.get("x-api-key"), "secret");
    assert.equal(requests[2].headers.get("anthropic-version"), "2023-06-01");
    assert.equal(requests[3].headers.get("x-goog-api-key"), "secret");
    assert.equal(requests[0].headers.get("authorization"), "Bearer secret");
    assert.equal(requests[1].headers.get("authorization"), "Bearer secret");
});


test("keeps the complete Zen catalog and safely ignores malformed discovery payloads", async () => {
    const zenModels = await listAvailableModels(connection(AI_PROVIDER.OPENCODE), "secret", async () => new Response(JSON.stringify({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "z-model" }] }), { status: 200 }));
    const googleModels = await listAvailableModels(connection(AI_PROVIDER.GOOGLE), "secret", async () => new Response(JSON.stringify({ models: [{ name: "models/gemini-test" }] }), { status: 200 }));
    const malformed = await listAvailableModels(connection(AI_PROVIDER.DEEPSEEK), "secret", async () => new Response("not json", { status: 200 }));

    assert.deepEqual(zenModels, ["a-model", "z-model"]);
    assert.deepEqual(googleModels, ["gemini-test"]);
    assert.deepEqual(malformed, []);
});
