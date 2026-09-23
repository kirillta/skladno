import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { SkillPackageIssue } from "./skill-package-issue.js";


export type SkillPackageParseResult =
    | { ok: true; skillPackage: AssistantSkillPackage }
    | { ok: false; issues: readonly SkillPackageIssue[] };
