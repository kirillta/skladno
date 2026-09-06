import assert from "node:assert/strict";
import test from "node:test";
import { aiModelPreferenceId } from "@skladno/shared";

import { ConfiguredEditorialEngineResolver, resolveTextGenerationConfiguration, resolveTextGenerationModel } from "./configured-editorial-engine-resolver.js";
import type { ServerConfig } from "../configuration/config.js";


test("supporting text prefers its model and otherwise falls back to the default", () => {
    assert.equal(resolveTextGenerationModel({ defaultModel: "default", textGenerationModel: "supporting" }, "configured"), "supporting");
    assert.equal(resolveTextGenerationModel({ defaultModel: "default" }, "configured"), "default");
    assert.equal(resolveTextGenerationModel(undefined, "configured"), "configured");
});


test("supporting text carries its own reasoning effort", () => {
    assert.deepEqual(resolveTextGenerationConfiguration({ defaultModel: "default", textGenerationModel: "supporting", textGenerationReasoningEffort: "high" }, "configured"), { model: "supporting", reasoningEffort: "high" });
});


test("resolves the active connection's provider and isolated model preference", () => {
    const resolver = new ConfiguredEditorialEngineResolver(
        { host: "127.0.0.1", port: 8787, webOrigin: "http://localhost:5173", databasePath: "unused", aiApiKey: undefined, aiModel: "gpt-5.6", aiSessionContinuationEnabled: true } satisfies ServerConfig,
        {
            get: (key) => key === "application-ai-connections"
                ? { key, updatedAt: "now", value: { connections: [{ id: "anthropic", provider: "anthropic", label: "Claude", credentialSource: { kind: "environment-variable", environmentVariableName: "ANTHROPIC_API_KEY" }, status: "connected" }], activeConnectionId: "anthropic" } }
                : { key, updatedAt: "now", value: { byConnection: { anthropic: { defaultModel: "claude-sonnet", skillOverrides: {} } } } },
            set: () => ({ key: "", value: undefined, updatedAt: "now" }),
        },
    );
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    try {
        assert.deepEqual(resolver.resolve("flow_revision")?.continuationScope, { connectionId: "anthropic", provider: "anthropic", model: "claude-sonnet" });
    } finally {
        if (original === undefined)
            delete process.env.ANTHROPIC_API_KEY;
        else
            process.env.ANTHROPIC_API_KEY = original;
    }
});


test("routes a selected model through the active connection that supplied it", () => {
    const resolver = new ConfiguredEditorialEngineResolver(
        { host: "127.0.0.1", port: 8787, webOrigin: "http://localhost:5173", databasePath: "unused", aiApiKey: undefined, aiModel: "gpt-5.6", aiSessionContinuationEnabled: true } satisfies ServerConfig,
        {
            get: (key) => key === "application-ai-connections"
                ? { key, updatedAt: "now", value: { connections: [
                    { id: "openai", provider: "openai", label: "OpenAI", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENAI_API_KEY" }, active: true, status: "connected" },
                    { id: "zen", provider: "opencode", label: "OpenCode Zen", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENCODE_API_KEY" }, active: true, status: "connected" },
                ] } }
                : { key, updatedAt: "now", value: { defaultModel: aiModelPreferenceId("zen", "claude-sonnet"), skillOverrides: {} } },
            set: () => ({ key: "", value: undefined, updatedAt: "now" }),
        },
    );
    const original = process.env.OPENCODE_API_KEY;
    process.env.OPENCODE_API_KEY = "test-key";
    try {
        assert.deepEqual(resolver.resolve("flow_revision")?.continuationScope, { connectionId: "zen", provider: "opencode", model: "claude-sonnet" });
    } finally {
        if (original === undefined)
            delete process.env.OPENCODE_API_KEY;
        else
            process.env.OPENCODE_API_KEY = original;
    }
});
