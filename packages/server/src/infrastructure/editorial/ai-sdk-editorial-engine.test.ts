import assert from "node:assert/strict";
import test from "node:test";

import { assistantConversationPrompt, assistantStepOptions } from "./ai-sdk-editorial-engine.js";
import { supportingTextProviderOptions } from "./ai-sdk-provider.js";
import { openAiResponsesProviderOptions } from "./openai-responses.js";
import { AI_PROVIDER } from "@skladno/shared";


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
    assert.deepEqual(openAiResponsesProviderOptions(false, "resp-earlier"), { openai: { store: false } });
    assert.deepEqual(openAiResponsesProviderOptions(true), { openai: { store: true } });
    assert.deepEqual(openAiResponsesProviderOptions(true, "resp-earlier"), { openai: { store: true, previousResponseId: "resp-earlier" } });
    assert.deepEqual(openAiResponsesProviderOptions(false, undefined, "high"), { openai: { store: false, reasoningEffort: "high" } });
});


test("supporting text keeps OpenAI reasoning settings without forwarding them to other providers", () => {
    assert.deepEqual(supportingTextProviderOptions(AI_PROVIDER.OPENAI, "high"), { openai: { store: false, reasoningEffort: "high" } });
    assert.equal(supportingTextProviderOptions(AI_PROVIDER.ANTHROPIC, "high"), undefined);
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
