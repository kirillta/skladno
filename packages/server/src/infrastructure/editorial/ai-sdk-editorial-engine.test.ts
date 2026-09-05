import assert from "node:assert/strict";
import test from "node:test";

import { assistantConversationPrompt, assistantStepOptions, responsesPrompt, responsesProviderOptions } from "./ai-sdk-editorial-engine.js";


test("moves system messages into Responses API instructions", () => {
    assert.deepEqual(responsesPrompt([
        { role: "system", content: "Assistant guidance" },
        { role: "system", content: "Article context" },
        { role: "user", content: "ping" },
    ]), {
        instructions: "Assistant guidance\n\nArticle context",
        messages: [{ role: "user", content: "ping" }],
    });
});


test("keeps previous Assistant output separate from the next Author request", () => {
    assert.deepEqual(assistantConversationPrompt({
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
    assert.deepEqual(responsesProviderOptions(false, "resp-earlier"), { openai: { store: false } });
    assert.deepEqual(responsesProviderOptions(true), { openai: { store: true } });
    assert.deepEqual(responsesProviderOptions(true, "resp-earlier"), { openai: { store: true, previousResponseId: "resp-earlier" } });
    assert.deepEqual(responsesProviderOptions(false, undefined, "high"), { openai: { store: false, reasoningEffort: "high" } });
});


test("a resolved skill must call its artifact tool before it can answer", () => {
    assert.deepEqual(assistantStepOptions(0, ["translate", "inspect_translations"]), {
        activeTools: ["translate", "inspect_translations", "find_capabilities", "load_skill"],
        toolChoice: { type: "tool", toolName: "translate" },
    });
    assert.deepEqual(assistantStepOptions(1, ["translate", "inspect_translations"]), {
        activeTools: ["translate", "inspect_translations", "find_capabilities", "load_skill"],
    });
});
