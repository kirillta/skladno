import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, builtInSkills } from "@skladno/shared";

import { AssistantSkillCatalog, builtInSkillSource } from "./assistant-skill-catalog.js";


test("built-in Skills publish compact discovery data and load versioned instructions only when selected", () => {
    const catalog = new AssistantSkillCatalog([builtInSkillSource]);
    const summaries = catalog.discover();

    assert.deepEqual(summaries.map((summary) => summary.reference.id), builtInSkills);
    assert.ok(summaries.every((summary) => summary.reference.source === "built-in" && summary.reference.version === "1" && summary.name && summary.description));
    assert.equal("instructions" in summaries[0]!, false);

    const [factChecking] = catalog.load([summaries.find((summary) => summary.reference.id === BUILT_IN_SKILL.FACT_CHECKING)!.reference]);
    assert.match(factChecking?.references?.[0] ?? "", /advisory/);
    assert.deepEqual(catalog.load([]), []);
});


test("explicit and complementary Skill references load through the same catalog", () => {
    const catalog = new AssistantSkillCatalog([builtInSkillSource]);
    const summaries = catalog.discover();
    const translation = summaries.find((summary) => summary.reference.id === BUILT_IN_SKILL.TRANSLATION)!;
    const flow = summaries.find((summary) => summary.reference.id === BUILT_IN_SKILL.FLOW_AND_CLARITY)!;

    assert.deepEqual(catalog.load([translation.reference, flow.reference, translation.reference]).map((skillPackage) => skillPackage.reference.id), [BUILT_IN_SKILL.TRANSLATION, BUILT_IN_SKILL.FLOW_AND_CLARITY]);
});
