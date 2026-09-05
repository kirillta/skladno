import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_ERROR, AI_PROVIDER } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import { createProviderModel } from "./provider-model.js";


function modelDetails(candidate: ReturnType<typeof createProviderModel>): { modelId: string; provider: string } {
    if (!candidate || typeof candidate !== "object" || !("modelId" in candidate) || !("provider" in candidate) || typeof candidate.modelId !== "string" || typeof candidate.provider !== "string")
        throw new Error("Expected an SDK language model.");

    return { modelId: candidate.modelId, provider: candidate.provider };
}


test("creates a direct SDK model for every supported provider", () => {
    const models = [
        [AI_PROVIDER.OPENAI, "gpt-5.6"],
        [AI_PROVIDER.ANTHROPIC, "claude-sonnet-4-5"],
        [AI_PROVIDER.GOOGLE, "gemini-3-flash"],
        [AI_PROVIDER.XAI, "grok-4.6"],
        [AI_PROVIDER.DEEPSEEK, "deepseek-v4-flash"],
    ] as const;

    for (const [provider, model] of models)
        assert.equal(modelDetails(createProviderModel({ provider, apiKey: "secret", model })).modelId, model);
});


test("routes Zen models through their documented model protocol", () => {
    const models = [
        ["gpt-5.6", "openai.responses"],
        ["claude-sonnet-4-5", "anthropic.messages"],
        ["gemini-3-flash", "google.generative-ai"],
        ["deepseek-v4-flash", "opencode.chat"],
    ] as const;

    for (const [model, provider] of models) {
        const languageModel = modelDetails(createProviderModel({ provider: AI_PROVIDER.OPENCODE, apiKey: "secret", model: `opencode/${model}` }));
        assert.equal(languageModel.modelId, model);
        assert.equal(languageModel.provider, provider);
    }
});


test("rejects an undocumented Zen protocol before generation", () => {
    assert.throws(
        () => createProviderModel({ provider: AI_PROVIDER.OPENCODE, apiKey: "secret", model: "unknown-model" }),
        (error: unknown) => error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED,
    );
});
