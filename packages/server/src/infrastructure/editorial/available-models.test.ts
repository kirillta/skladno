import assert from "node:assert/strict";
import test from "node:test";

import { editorialModels } from "./available-models.js";


test("lists current editorial model variants", () => {
    assert.deepEqual(editorialModels(["babbage-002", "gpt-5.5", "gpt-5.5-mini", "gpt-5.6-luna", "gpt-image-1"]), ["gpt-5.5", "gpt-5.5-mini", "gpt-5.6-luna"]);
});
