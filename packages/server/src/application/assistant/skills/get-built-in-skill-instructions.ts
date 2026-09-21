import type { BuiltInSkillId } from "@skladno/shared";

import { loadBuiltInSkillPackages } from "./built-in-skill-packages.js";


export function getBuiltInSkillInstructions(skillId: BuiltInSkillId): string {
    const skillPackage = loadBuiltInSkillPackages().find((candidate) => candidate.reference.id === skillId);
    if (!skillPackage)
        throw new Error("invalid_builtin_skill_package");

    return skillPackage.instructions;
}
