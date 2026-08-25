import assert from "node:assert/strict";
import test from "node:test";

import { resolveTextGenerationConfiguration, resolveTextGenerationModel } from "./configured-editorial-engine-resolver.js";


test("supporting text prefers its model and otherwise falls back to the default", () => {
    assert.equal(resolveTextGenerationModel({ defaultModel: "default", textGenerationModel: "supporting" }, "configured"), "supporting");
    assert.equal(resolveTextGenerationModel({ defaultModel: "default" }, "configured"), "default");
    assert.equal(resolveTextGenerationModel(undefined, "configured"), "configured");
});


test("supporting text carries its own reasoning effort", () => {
    assert.deepEqual(resolveTextGenerationConfiguration({ defaultModel: "default", textGenerationModel: "supporting", textGenerationReasoningEffort: "high" }, "configured"), { model: "supporting", reasoningEffort: "high" });
});
