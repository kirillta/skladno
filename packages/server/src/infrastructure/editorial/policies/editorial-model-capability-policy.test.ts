import assert from "node:assert/strict";
import test from "node:test";
import { AI_PROVIDER, EDITORIAL_OPERATION } from "@skladno/shared";

import { EditorialModelCapabilityPolicy } from "./editorial-model-capability-policy.js";


test("allows manual model IDs only for basic text generation", () => {
    const policy = new EditorialModelCapabilityPolicy();

    assert.equal(policy.supportsOperation(AI_PROVIDER.DEEPSEEK, "manual-model", EDITORIAL_OPERATION.FLOW_REVISION), true);
    assert.equal(policy.supportsOperation(AI_PROVIDER.DEEPSEEK, "manual-model", EDITORIAL_OPERATION.STYLE_REVIEW), false);
    assert.equal(policy.supportsOperation(AI_PROVIDER.XAI, "grok-4", EDITORIAL_OPERATION.TRANSLATION), true);
    assert.equal(policy.getCapabilities(AI_PROVIDER.OPENAI, "gpt-5").sourcedResearch, true);
    assert.equal(policy.getCapabilities(AI_PROVIDER.ANTHROPIC, "claude-sonnet").sourcedResearch, false);
    assert.equal(policy.supportsOperation(AI_PROVIDER.ANTHROPIC, "claude-sonnet", EDITORIAL_OPERATION.FACT_CHECK), false);
});
