import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, EDITORIAL_OPERATION } from "@skladno/shared";

import { createEditorialMessages } from "./workflow-prompt.js";


function promptText(input: Parameters<typeof createEditorialMessages>[0]): string {
    const messages = createEditorialMessages(input);

    return messages.map((message) => typeof message.content === "string" ? message.content : "").join("\n");
}


test("thesis-to-narrative prompt preserves author control and supplied theses", async () => {
    const prompt = promptText({
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


// Product scenario: editorial-workflows.talking-points-source
test("talking-points prompt prioritizes the Author's message and defaults to 3–5 theses", async () => {
    const prompt = promptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Existing Article content.",
        authorContext: "Why retries need an upper bound.",
        skillId: BUILT_IN_SKILL.TALKING_POINTS,
    });

    assert.match(prompt, /Author's message:\nWhy retries need an upper bound/);
    assert.doesNotMatch(prompt, /Existing Article content/);
    assert.match(prompt, /between 3 and 5 theses/);
    assert.match(prompt, /ask the Author only the focused questions needed/);
});


test("talking-points prompt falls back to Article content when the composer is empty", async () => {
    const prompt = promptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Retries can amplify an outage.",
        authorContext: "   ",
        skillId: BUILT_IN_SKILL.TALKING_POINTS,
    });

    assert.match(prompt, /Article content:\nRetries can amplify an outage/);
});


test("flow-revision prompt asks for a full-text proposal rather than feedback", async () => {
    const prompt = promptText({
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
    const prompt = promptText({
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
    const prompt = promptText({
        operation: EDITORIAL_OPERATION.TRANSLATION,
        article: "Use [[SKLADNO_PROTECTED_0]].",
        authorContext: "Keep the direct tone.",
        targetLanguage: "Spanish",
    });

    assert.match(prompt, /Translate the complete article into Spanish/);
    assert.match(prompt, /copy every token exactly once/);
    assert.match(prompt, /\[\[SKLADNO_PROTECTED_0\]\]/);
});
