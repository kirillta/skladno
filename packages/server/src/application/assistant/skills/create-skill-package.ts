import { createHash } from "node:crypto";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";


export function createSkillPackage(input: Omit<AssistantSkillPackage, "contentHash">): AssistantSkillPackage {
    const content = [input.reference.id, input.reference.version, input.name, input.description, input.instructions, ...(input.references ?? [])].join("\n");
    return { ...input, contentHash: createHash("sha256").update(content).digest("hex") };
}
