import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, EDITORIAL_OPERATION } from "@skladno/shared";

import { authorControlInstruction, createEditorialMessages } from "./workflow-prompt.js";


function getPromptText(input: Parameters<typeof createEditorialMessages>[0]): string {
    const messages = createEditorialMessages(input);

    return messages.map((message) => typeof message.content === "string" ? message.content : "").join("\n");
}


test("direct thesis composition uses the Narrative Draft prompt", async () => {
    const input = {
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Current draft.",
        articleTitle: "Saved title",
        authorContext: "Explain Kubernetes retries for senior engineers.",
    };
    const prompt = getPromptText(input);

    assert.deepEqual(createEditorialMessages(input), createEditorialMessages({ ...input, skillId: BUILT_IN_SKILL.NARRATIVE_DRAFT }));
    assert.match(prompt, /Explain Kubernetes retries/);
    assert.match(prompt, /Current draft/);
    assert.match(prompt, /Preserve the author's claims, numbers, URLs, code, technical terms/);
    assert.match(prompt, /Do not invent facts, examples, or sources/);
    assert.ok(prompt.includes(authorControlInstruction));
    assert.match(prompt, /Current Article title:\nSaved title/);
    assert.match(prompt, /title is managed separately/i);
});


// Product scenario: editorial-workflows.talking-points-source
test("talking-points prompt prioritizes the Author's message and defaults to 3–5 theses", async () => {
    const prompt = getPromptText({
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
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Retries can amplify an outage.",
        authorContext: "   ",
        skillId: BUILT_IN_SKILL.TALKING_POINTS,
    });

    assert.match(prompt, /Article content:\nRetries can amplify an outage/);
});


test("talking-points prompt uses an Article selection as primary and allows the Author's message to extend it", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Selected evidence with two concrete claims.",
        articleSelection: true,
        authorContext: "Find ideas across the whole Article.",
        skillId: BUILT_IN_SKILL.TALKING_POINTS,
    });

    assert.match(prompt, /Article selection:\nSelected evidence with two concrete claims/);
    assert.match(prompt, /Author message \(supplementary direction or material that may extend the selection\)/);
    assert.match(prompt, /treat only the selection and any material explicitly supplied in the Author's message as source material/);
    assert.match(prompt, /selection plus any supplementary material the Author explicitly provides/);
});


// Product scenario: editorial-workflows.narrative-draft-source
test("narrative-draft prompt follows Author direction, selection priority, and the resulting Article size hint", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Selected theses.",
        articleTitle: "Existing Article title",
        articleSelection: true,
        authorContext: "Add one simple example.",
        skillId: BUILT_IN_SKILL.NARRATIVE_DRAFT,
        surroundingArticleCharacterCount: 800,
        targetArticleCharacterLimit: 1_300,
    });

    assert.match(prompt, /Author message \(highest-priority direction and supplementary material\):\nAdd one simple example/);
    assert.match(prompt, /Article selection:\nSelected theses/);
    assert.match(prompt, /treat only the selection and any material explicitly supplied in the Author's message as source material/);
    assert.match(prompt, /resulting complete Article: about 1300 characters/);
    assert.match(prompt, /not a hard limit on your response/);
    assert.match(prompt, /unchanged surrounding Article currently contains 800 characters/);
    assert.match(prompt, /Output format:\nSelected-passage Markdown replacement/);
    assert.match(prompt, /title is managed separately/i);
    assert.doesNotMatch(prompt, /Current Article title:\nExisting Article title/);
    assert.match(prompt, /not the Article's author/);
    assert.match(prompt, /Prefer straightforward structure and ideas/);
});

test("full Narrative Draft uses the existing Article title without adding it to the body", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
        article: "Draft body.",
        articleTitle: "Existing Article title",
        authorContext: "",
        skillId: BUILT_IN_SKILL.NARRATIVE_DRAFT,
    });

    assert.match(prompt, /Current Article title:\nExisting Article title/);
    assert.match(prompt, /title is managed separately/i);
    assert.match(prompt, /do not include a title or title label in the proposed body/i);
});


test("flow-revision prompt asks for a full-text proposal rather than feedback", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.FLOW_REVISION,
        article: "Current draft.",
        articleTitle: "Saved title",
        authorContext: "Keep the opening sentence.",
    });

    assert.match(prompt, /Revise the current Article as a complete Article/);
    assert.match(prompt, /complete Article/);
    assert.match(prompt, /do not summarize it or turn it into feedback/);
    assert.match(prompt, /make only that change\. Preserve all other wording, punctuation, and formatting exactly/);
    assert.match(prompt, /Keep the opening sentence/);
    assert.match(prompt, /Current Article title:\nSaved title/);
    assert.match(prompt, /do not include a title or title label in the proposed body/i);
});


test("style review sends a compact profile rather than raw corpus text", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.STYLE_REVIEW,
        article: "Current draft.",
        articleTitle: "Saved title",
        authorContext: "",
        styleProfile: {
            version: 1,
            corpusItemCount: 1,
            characterCount: 120,
            confidence: "low",
            updatedAt: "2026-07-28T00:00:00.000Z",
            traits: [{ id: "paragraphing", label: "Compact paragraphs", evidence: "Observed locally." }],
            phrasesToAvoid: [],
            contributorIds: ["sample-1"],
            rules: "",
        },
    });

    assert.match(prompt, /Supplied corpus traits/);
    assert.match(prompt, /paragraphing: Compact paragraphs/);
    assert.match(prompt, /No additional author guidance was provided/);
    assert.match(prompt, /Current Article title:\nSaved title/);
    assert.match(prompt, /do not include a title or title label in the proposed body/i);
});

test("selected editorial text does not send the surrounding Article title", () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.FLOW_REVISION,
        article: "Selected passage.",
        articleTitle: "Private surrounding title",
        articleSelection: true,
        authorContext: "",
    });

    assert.doesNotMatch(prompt, /Private surrounding title/);
});


test("translation prompt names the target language and preserves protected tokens", async () => {
    const prompt = getPromptText({
        operation: EDITORIAL_OPERATION.TRANSLATION,
        article: "Use [[SKLADNO_PROTECTED_0]].",
        articleTitle: "Deploy Node.js safely",
        authorContext: "Keep the direct tone.",
        targetLanguage: "Spanish",
    });

    assert.match(prompt, /Target language:\nSpanish/);
    assert.match(prompt, /Translate its title and body in the same response/);
    assert.match(prompt, /title field.*translation field.*body only/i);
    assert.match(prompt, /Deploy Node\.js safely/);
    assert.match(prompt, /copy every token exactly once/);
    assert.match(prompt, /\[\[SKLADNO_PROTECTED_0\]\]/);
});
