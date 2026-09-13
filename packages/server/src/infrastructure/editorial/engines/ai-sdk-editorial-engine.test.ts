import assert from "node:assert/strict";
import test from "node:test";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { AI_PROVIDER, EDITORIAL_OPERATION } from "@skladno/shared";
import { MockLanguageModelV3 } from "ai/test";

import { EDITORIAL_ENGINE_EVENT } from "../../../application/editorial/engine/editorial-engine-events.js";
import { AiSdkEditorialEngine, createAssistantConversationPrompt, getAssistantStepOptions } from "./ai-sdk-editorial-engine.js";
import { getSupportingTextProviderOptions } from "../adapters/ai-sdk-provider.js";
import { getOpenAiResponsesProviderOptions } from "../adapters/openai-responses.js";


test("keeps previous Assistant output separate from the next Author request", () => {
    assert.deepEqual(createAssistantConversationPrompt({
        article: "Article context",
        history: [
            { role: "author", content: "Previous question" },
            { role: "assistant", content: "Previous answer" },
        ],
        message: "New question",
        scope: "article",
    }), [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
        { role: "user", content: "Author request:\nNew question\n\nCurrent Article context:\nArticle context" },
    ]);
});


test("Responses storage is opt-in and continuation stays scoped to it", () => {
    assert.deepEqual(getOpenAiResponsesProviderOptions(false, "resp-earlier"), { openai: { store: false } });
    assert.deepEqual(getOpenAiResponsesProviderOptions(true), { openai: { store: true } });
    assert.deepEqual(getOpenAiResponsesProviderOptions(true, "resp-earlier"), { openai: { store: true, previousResponseId: "resp-earlier" } });
    assert.deepEqual(getOpenAiResponsesProviderOptions(false, undefined, "high"), { openai: { store: false, reasoningEffort: "high" } });
});


test("supporting text keeps OpenAI reasoning settings without forwarding them to other providers", () => {
    assert.deepEqual(getSupportingTextProviderOptions(AI_PROVIDER.OPENAI, "high"), { openai: { store: false, reasoningEffort: "high" } });
    assert.equal(getSupportingTextProviderOptions(AI_PROVIDER.ANTHROPIC, "high"), undefined);
});


test("a resolved skill must call its artifact tool before it can answer", () => {
    assert.deepEqual(getAssistantStepOptions(0, ["translate", "inspect_translations"]), {
        activeTools: ["translate", "inspect_translations", "find_capabilities", "load_skill"],
        toolChoice: { type: "tool", toolName: "translate" },
    });
    assert.deepEqual(getAssistantStepOptions(1, ["translate", "inspect_translations"]), {
        activeTools: ["translate", "inspect_translations", "find_capabilities", "load_skill"],
    });
});


test("editorial prompts route system messages through AI SDK 7 instructions", async () => {
    const model = new MockLanguageModelV3({
        doStream: {
            stream: new ReadableStream<LanguageModelV3StreamPart>({
                start(controller) {
                    controller.enqueue({ type: "text-start", id: "text" });
                    controller.enqueue({ type: "text-delta", id: "text", delta: "Clear revision" });
                    controller.enqueue({ type: "text-end", id: "text" });
                    controller.enqueue({
                        type: "finish",
                        finishReason: { unified: "stop", raw: undefined },
                        usage: {
                            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                            outputTokens: { total: 1, text: 1, reasoning: 0 },
                        },
                    });
                    controller.close();
                },
            }),
        },
    });
    const engine = new AiSdkEditorialEngine({ provider: AI_PROVIDER.OPENAI, languageModel: model, storeResponses: false });
    const events = [];

    for await (const event of engine.stream({
        operation: EDITORIAL_OPERATION.FLOW_REVISION,
        article: "An Article that needs clearer flow.",
        authorContext: "Keep it concise.",
    }, new AbortController().signal))
        events.push(event.type);

    assert.deepEqual(events, [EDITORIAL_ENGINE_EVENT.TEXT_DELTA, EDITORIAL_ENGINE_EVENT.COMPLETED]);
});
