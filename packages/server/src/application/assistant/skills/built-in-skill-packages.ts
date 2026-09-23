import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { builtInSkills } from "@skladno/shared";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import { parseSkillPackage } from "./skill-package-parser.js";


function isBuiltInSkillPackageId(id: string): boolean {
    return builtInSkills.some((candidate) => candidate === id);
}


export function loadBuiltInSkillPackages(root = process.env.SKLADNO_BUILT_IN_SKILLS_DIR ?? resolve(import.meta.dirname, "built-in")): readonly AssistantSkillPackage[] {
    const packages: AssistantSkillPackage[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory())
            throw new Error("invalid_builtin_skill_package");

        const parsed = parseSkillPackage({ root: resolve(root, entry.name), source: "built-in" });
        if (!parsed.ok)
            throw new Error(`invalid_builtin_skill_package:${parsed.issues[0]!.code}`);

        packages.push(parsed.skillPackage);
    }

    if (packages.length !== builtInSkills.length || packages.some((skillPackage) => !isBuiltInSkillPackageId(skillPackage.reference.id)))
        throw new Error("invalid_builtin_skill_package");

    return packages.sort((left, right) => builtInSkills.findIndex((id) => id === left.reference.id) - builtInSkills.findIndex((id) => id === right.reference.id));
}
