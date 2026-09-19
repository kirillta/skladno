import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { AI_PROVIDER } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../../application/editorial/engine/editorial-engine-events.js";
import { AiSdkAssistantExecutor, createAssistantInstructions } from "./ai-sdk-assistant-executor.js";


test("Assistant distinguishes prepared translations from linked translation Articles before rejection", () => {
    assert.match(createAssistantInstructions({ instructions: [], skills: [] }), /inspect_translations first.*artifactId.*reject_translation.*never use inspect_linked_articles/s);
});


test("Assistant completes only after a successful final finish reason", async () => {
    for (const reason of ["length", "content-filter", "error", "other", "stop"] as const) {
        const model = new MockLanguageModelV3({
            doStream: {
                stream: new ReadableStream<LanguageModelV3StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "text-start", id: "text" });
                        controller.enqueue({ type: "text-delta", id: "text", delta: "Assistant answer" });
                        controller.enqueue({ type: "text-end", id: "text" });
                        controller.enqueue({
                            type: "finish",
                            finishReason: { unified: reason, raw: undefined },
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
        const executor = new AiSdkAssistantExecutor({ languageModel: model, provider: AI_PROVIDER.OPENAI, storeResponses: false });
        const events: string[] = [];
        const consume = async () => {
            for await (const event of executor.stream({
                message: "Hello", article: "", scope: "article", instructions: [], history: [], skills: [],
                tools: [{ capability: "find_capabilities", description: "Discover capabilities", input: "capability-query", execute: async () => [] }],
            }, new AbortController().signal))
                events.push(event.type);
        };

        if (reason === "stop") {
            await consume();
            assert.deepEqual(events, [EDITORIAL_ENGINE_EVENT.TEXT_DELTA, EDITORIAL_ENGINE_EVENT.COMPLETED]);
        } else {
            await assert.rejects(consume(), { code: EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM }, reason);
            assert.deepEqual(events, [EDITORIAL_ENGINE_EVENT.TEXT_DELTA], reason);
        }
    }
});


test("Assistant fails when an artifact tool fails instead of completing with the model's explanation", async () => {
    const usage = {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const model = new MockLanguageModelV3({
        doStream: [
            {
                stream: new ReadableStream<LanguageModelV3StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "tool-call", toolCallId: "translation", toolName: "translate", input: JSON.stringify({ targetLanguage: "Spanish" }) });
                        controller.enqueue({ type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage });
                        controller.close();
                    },
                }),
            },
            {
                stream: new ReadableStream<LanguageModelV3StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "text-start", id: "text" });
                        controller.enqueue({ type: "text-delta", id: "text", delta: "Translation failed." });
                        controller.enqueue({ type: "text-end", id: "text" });
                        controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage });
                        controller.close();
                    },
                }),
            },
        ],
    });
    const executor = new AiSdkAssistantExecutor({ languageModel: model, provider: AI_PROVIDER.OPENAI, storeResponses: false });
    const events: string[] = [];
    const consume = async () => {
        for await (const event of executor.stream({
            message: "Translate to Spanish", article: "Article", scope: "article", instructions: [], history: [], skills: [], initialActiveCapabilities: ["translate"],
            tools: [{
                capability: "translate", description: "Prepare translation", input: "target-language", execute: async () => {
                    throw new Error("translation failed");
                }
            }],
        }, new AbortController().signal))
            events.push(event.type);
    };

    await assert.rejects(consume(), /translation failed/);
    assert.deepEqual(events, []);
});
