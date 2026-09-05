import assert from "node:assert/strict";
import test from "node:test";

import { ApplicationSettingsService } from "./application-settings-service.js";


function service(records: Map<string, unknown>) {
    return new ApplicationSettingsService(
        {
            get: (key) => records.has(key) ? { key, value: records.get(key), updatedAt: "now" } : undefined,
            set: (key, value) => {
                records.set(key, value);
                return { key, value, updatedAt: "now" };
            },
        },
        { read: async () => ({}) },
        { list: async () => [] },
        () => "new-connection",
    );
}


test("migrates legacy model preferences to the active connection and keeps later connections isolated", async () => {
    const records = new Map<string, unknown>([
        ["application-ai-connections", {
            connections: [
                { id: "openai", provider: "openai", label: "OpenAI", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENAI_API_KEY" }, status: "connected" },
                { id: "anthropic", provider: "anthropic", label: "Anthropic", credentialSource: { kind: "environment-variable", environmentVariableName: "ANTHROPIC_API_KEY" }, status: "connected" },
            ],
            activeConnectionId: "openai",
        }],
        ["application-model-preferences", { defaultModel: "gpt-5.6", skillOverrides: { talking_points: "gpt-5.6-mini" } }],
    ]);
    const settings = service(records);

    assert.equal((await settings.getSnapshot()).modelPreferences.defaultModel, "gpt-5.6");
    settings.activateAiConnection("anthropic");
    settings.updateModelPreferences({ defaultModel: "claude-sonnet", skillOverrides: {} });
    settings.activateAiConnection("openai");

    assert.equal((await settings.getSnapshot()).modelPreferences.defaultModel, "gpt-5.6");
    settings.activateAiConnection("anthropic");
    assert.equal((await settings.getSnapshot()).modelPreferences.defaultModel, "claude-sonnet");
});
