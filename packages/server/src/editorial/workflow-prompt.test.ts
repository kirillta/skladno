import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION } from "@skladno/shared";

import { createEditorialMessages } from "./workflow-prompt.js";


async function promptText(input: Parameters<typeof createEditorialMessages>[0]): Promise<string> {
    const messages = await createEditorialMessages(input);

    return messages.map((message) => message.text).join("\n");
}


test("thesis-to-narrative prompt preserves author control and supplied theses", async () => {
    const prompt = await promptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Current draft.",
        authorContext: "Explain Kubernetes retries for senior engineers.",
    });

    assert.match(prompt, /Workflow: thesis to narrative/);
    assert.match(prompt, /Explain Kubernetes retries/);
    assert.match(prompt, /Current draft/);
    assert.match(prompt, /Preserve the author's claims, numbers, URLs, code, technical terms/);
    assert.match(prompt, /Do not invent facts, examples, or sources/);
    assert.match(prompt, /never say that you saved or changed the article/);
});


test("flow-revision prompt asks for a full-text proposal rather than feedback", async () => {
    const prompt = await promptText({
        operation: EDITORIAL_OPERATION.FLOW_REVISION,
        article: "Current draft.",
        authorContext: "Keep the opening sentence.",
    });

    assert.match(prompt, /Workflow: flow revision/);
    assert.match(prompt, /complete article/);
    assert.match(prompt, /do not summarize it or turn it into feedback/);
    assert.match(prompt, /Keep the opening sentence/);
});


test("style review sends a compact profile rather than raw corpus text", async () => {
    const prompt = await promptText({
        operation: EDITORIAL_OPERATION.STYLE_REVIEW,
        article: "Current draft.",
        authorContext: "",
        styleProfile: {
            corpusItemCount: 1,
            characterCount: 120,
            confidence: "low",
            updatedAt: "2026-07-28T00:00:00.000Z",
            traits: [{ id: "paragraphing", label: "Compact paragraphs", evidence: "Observed locally." }],
        },
    });

    assert.match(prompt, /Supplied corpus traits/);
    assert.match(prompt, /paragraphing: Compact paragraphs/);
    assert.match(prompt, /No additional author guidance was provided/);
});


test("translation prompt names the target language and preserves protected tokens", async () => {
    const prompt = await promptText({
        operation: EDITORIAL_OPERATION.TRANSLATION,
        article: "Use [[SKLADNO_PROTECTED_0]].",
        authorContext: "Keep the direct tone.",
        targetLanguage: "Spanish",
    });

    assert.match(prompt, /Translate the complete article into Spanish/);
    assert.match(prompt, /copy every token exactly once/);
    assert.match(prompt, /\[\[SKLADNO_PROTECTED_0\]\]/);
});
