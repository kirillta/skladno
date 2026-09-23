import type { SkillPackageIssue } from "./skill-package-issue.js";


export interface AuthorSkillPackageStatus {
    directory: string;
    issues: readonly SkillPackageIssue[];
}
