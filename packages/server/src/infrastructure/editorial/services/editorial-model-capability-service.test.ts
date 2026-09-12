import assert from "node:assert/strict";
import test from "node:test";
import { AI_PROVIDER, EDITORIAL_OPERATION } from "@skladno/shared";

import { EditorialModelCapabilityService } from "./editorial-model-capability-service.js";


test("allows manual model IDs only for basic text generation", () => {
    const service = new EditorialModelCapabilityService();

    assert.equal(service.supportsOperation(AI_PROVIDER.DEEPSEEK, "manual-model", EDITORIAL_OPERATION.FLOW_REVISION), true);
    assert.equal(service.supportsOperation(AI_PROVIDER.DEEPSEEK, "manual-model", EDITORIAL_OPERATION.STYLE_REVIEW), false);
    assert.equal(service.supportsOperation(AI_PROVIDER.XAI, "grok-4", EDITORIAL_OPERATION.TRANSLATION), true);
    assert.equal(service.capabilities(AI_PROVIDER.OPENAI, "gpt-5").sourcedResearch, true);
    assert.equal(service.capabilities(AI_PROVIDER.ANTHROPIC, "claude-sonnet").sourcedResearch, false);
    assert.equal(service.supportsOperation(AI_PROVIDER.ANTHROPIC, "claude-sonnet", EDITORIAL_OPERATION.FACT_CHECK), false);
});
