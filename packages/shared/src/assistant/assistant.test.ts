import assert from "node:assert/strict";
import test from "node:test";

import { BUILT_IN_SKILL, builtInSkillScopeCompatibility, legacyEditorialOperationSkillMap, resolveBuiltInSkillId } from "../index.js";

test("resolves current skill IDs and legacy editorial operations through one compatibility seam", () => {
    assert.equal(resolveBuiltInSkillId(BUILT_IN_SKILL.TALKING_POINTS), BUILT_IN_SKILL.TALKING_POINTS);
    assert.equal(resolveBuiltInSkillId("thesis_to_narrative"), BUILT_IN_SKILL.NARRATIVE_DRAFT);
    assert.equal(resolveBuiltInSkillId("flow_revision"), BUILT_IN_SKILL.FLOW_AND_CLARITY);
    assert.equal(resolveBuiltInSkillId("unknown"), undefined);
    assert.equal(legacyEditorialOperationSkillMap.translation, BUILT_IN_SKILL.TRANSLATION);
    assert.deepEqual(builtInSkillScopeCompatibility.talking_points, ["article", "selection"]);
});
