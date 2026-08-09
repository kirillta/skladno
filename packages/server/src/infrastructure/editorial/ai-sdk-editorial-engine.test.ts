import assert from "node:assert/strict";
import test from "node:test";

import { responsesPrompt } from "./ai-sdk-editorial-engine.js";


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
