import assert from "node:assert/strict";
import test from "node:test";

import { aiModelPreferenceId, type AiConnection } from "@skladno/shared";

import { ApplicationSettingsService } from "./application-settings-service.js";


function service(records: Map<string, unknown>, list: (connection: AiConnection) => Promise<string[]> = async () => []) {
    return new ApplicationSettingsService(
        {
            get: (key) => records.has(key) ? { key, value: records.get(key), updatedAt: "now" } : undefined,
            set: (key, value) => {
                records.set(key, value);
                return { key, value, updatedAt: "now" };
            },
        },
        { read: async () => ({}) },
        { list },
        () => "new-connection",
    );
}


test("allows more than one connection to use the same environment-variable key", () => {
    const records = new Map<string, unknown>();
    const settings = service(records);

    settings.createAiConnection({ provider: "openai", label: "OpenAI", environmentVariableName: "AI_API_KEY" });
    settings.createAiConnection({ provider: "opencode", label: "OpenCode Zen", environmentVariableName: "AI_API_KEY" });

    const connections = records.get("application-ai-connections") as { connections: { provider: string; credentialSource: { environmentVariableName: string } }[] };
    assert.deepEqual(connections.connections.map((connection) => [connection.provider, connection.credentialSource.environmentVariableName]), [["openai", "AI_API_KEY"], ["opencode", "AI_API_KEY"]]);
});


test("migrates legacy model preferences to a connection-bound selection", async () => {
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

    assert.equal((await settings.getSnapshot()).modelPreferences.defaultModel, aiModelPreferenceId("openai", "gpt-5.6"));
    assert.deepEqual(records.get("application-model-preferences"), { defaultModel: aiModelPreferenceId("openai", "gpt-5.6"), skillOverrides: { talking_points: aiModelPreferenceId("openai", "gpt-5.6-mini") } });
});


test("returns models from every active connection and preserves their route", async () => {
    const records = new Map<string, unknown>([["application-ai-connections", { connections: [
        { id: "openai", provider: "openai", label: "OpenAI", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENAI_API_KEY" }, active: true, status: "connected" },
        { id: "zen", provider: "opencode", label: "OpenCode Zen", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENCODE_API_KEY" }, active: true, status: "connected" },
        { id: "paused", provider: "anthropic", label: "Anthropic", credentialSource: { kind: "environment-variable", environmentVariableName: "ANTHROPIC_API_KEY" }, active: false, status: "connected" },
    ] }]]);
    const settings = service(records, async (connection: AiConnection) => connection.id === "openai" ? ["gpt-5.6"] : ["claude-sonnet"]);

    assert.deepEqual(await settings.listAiModels(), [
        { id: aiModelPreferenceId("openai", "gpt-5.6"), model: "gpt-5.6", connectionId: "openai", provider: "openai" },
        { id: aiModelPreferenceId("zen", "claude-sonnet"), model: "claude-sonnet", connectionId: "zen", provider: "opencode" },
    ]);
});
