import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION } from "@skladno/shared";

import { createEditorialPrompt } from "./workflow-prompt.js";


test("thesis-to-narrative prompt preserves author control and supplied theses", () => {
    const prompt = createEditorialPrompt(EDITORIAL_OPERATION.THESIS_TO_NARRATIVE, "Explain Kubernetes retries for senior engineers.");

    assert.match(prompt, /Workflow: thesis to narrative/);
    assert.match(prompt, /Explain Kubernetes retries/);
    assert.match(prompt, /Preserve the author's claims, numbers, URLs, code, technical terms/);
    assert.match(prompt, /Do not invent facts, examples, or sources/);
    assert.match(prompt, /never say that you saved or changed the article/);
});


test("flow-revision prompt asks for a full-text proposal rather than feedback", () => {
    const prompt = createEditorialPrompt(EDITORIAL_OPERATION.FLOW_REVISION, "Keep the opening sentence.");

    assert.match(prompt, /Workflow: flow revision/);
    assert.match(prompt, /complete article/);
    assert.match(prompt, /do not summarize it or turn it into feedback/);
    assert.match(prompt, /Keep the opening sentence/);
});
