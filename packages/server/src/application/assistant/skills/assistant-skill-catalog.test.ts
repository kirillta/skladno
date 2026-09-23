import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, builtInSkills } from "@skladno/shared";

import { AssistantSkillCatalog } from "./assistant-skill-catalog.js";
import { builtInSkillSource } from "./built-in-skill-source.js";


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


test("Skill Creator keeps its model instructions in the built-in package", () => {
    const catalog = new AssistantSkillCatalog([builtInSkillSource]);
    const creator = catalog.discover().find((summary) => summary.reference.id === BUILT_IN_SKILL.SKILL_CREATOR);

    assert.equal(creator?.name, "Skill Creator");
    assert.match(catalog.load([creator!.reference])[0]?.instructions ?? "", /Ask a concise clarifying question/);
    assert.match(catalog.load([creator!.reference])[0]?.instructions ?? "", /Use the Skladno Glossary as the authority for domain terms/);
});


test("explicit and complementary Skill references load through the same catalog", () => {
    const catalog = new AssistantSkillCatalog([builtInSkillSource]);
    const summaries = catalog.discover();
    const translation = summaries.find((summary) => summary.reference.id === BUILT_IN_SKILL.TRANSLATION)!;
    const flow = summaries.find((summary) => summary.reference.id === BUILT_IN_SKILL.FLOW_AND_CLARITY)!;

    assert.deepEqual(catalog.load([translation.reference, flow.reference, translation.reference]).map((skillPackage) => skillPackage.reference.id), [BUILT_IN_SKILL.TRANSLATION, BUILT_IN_SKILL.FLOW_AND_CLARITY]);
});


test("direct loading cannot bypass discovery reservations", () => {
    const reserved = builtInSkillSource.summaries()[0]!;
    const catalog = new AssistantSkillCatalog([
        builtInSkillSource,
        {
            id: "author",
            summaries: () => [{ ...reserved, reference: { ...reserved.reference, source: "author" } }],
            load: () => ({ ...reserved, instructions: "Must not load." }),
        },
    ]);

    assert.deepEqual(catalog.load([{ ...reserved.reference, source: "author" }]), []);
});
