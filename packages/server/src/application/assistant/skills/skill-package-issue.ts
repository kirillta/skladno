export interface SkillPackageIssue {
    code: "invalid_frontmatter" | "invalid_metadata" | "invalid_instructions" | "invalid_reference" | "unsafe_package" | "package_too_large";
    messageId: "skills.validation.invalid_frontmatter" | "skills.validation.invalid_metadata" | "skills.validation.invalid_instructions" | "skills.validation.invalid_reference" | "skills.validation.unsafe_package" | "skills.validation.package_too_large";
}
