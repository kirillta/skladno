export const BUILT_IN_SKILL = {
    TALKING_POINTS: "talking_points",
    NARRATIVE_DRAFT: "narrative_draft",
    FLOW_AND_CLARITY: "flow_and_clarity",
    FACT_CHECKING: "fact_checking",
    STYLE_REVIEW: "style_review",
    TRANSLATION: "translation",
} as const;

export type BuiltInSkillId = typeof BUILT_IN_SKILL[keyof typeof BUILT_IN_SKILL];

export const builtInSkills: readonly BuiltInSkillId[] = [
    BUILT_IN_SKILL.TALKING_POINTS,
    BUILT_IN_SKILL.NARRATIVE_DRAFT,
    BUILT_IN_SKILL.FLOW_AND_CLARITY,
    BUILT_IN_SKILL.FACT_CHECKING,
    BUILT_IN_SKILL.STYLE_REVIEW,
    BUILT_IN_SKILL.TRANSLATION,
];

export const builtInSkillScopeCompatibility: Record<BuiltInSkillId, readonly ("article" | "selection")[]> = {
    talking_points: ["article", "selection"],
    narrative_draft: ["article", "selection"],
    flow_and_clarity: ["article", "selection"],
    fact_checking: ["article", "selection"],
    style_review: ["article", "selection"],
    translation: ["article"],
};


export function isBuiltInSkillId(value: unknown): value is BuiltInSkillId {
    return typeof value === "string" && builtInSkills.includes(value as BuiltInSkillId);
}


/**
 * Compatibility only: maps pre-conversation editorial operation IDs to skills.
 * Do not persist or expose these IDs in new Assistant contracts.
 */
export const legacyEditorialOperationSkillMap = {
    thesis_to_narrative: BUILT_IN_SKILL.NARRATIVE_DRAFT,
    flow_revision: BUILT_IN_SKILL.FLOW_AND_CLARITY,
    fact_check: BUILT_IN_SKILL.FACT_CHECKING,
    style_review: BUILT_IN_SKILL.STYLE_REVIEW,
    translation: BUILT_IN_SKILL.TRANSLATION,
} as const;


export function resolveBuiltInSkillId(value: unknown): BuiltInSkillId | undefined {
    if (isBuiltInSkillId(value))
        return value;

    return typeof value === "string"
        ? legacyEditorialOperationSkillMap[value as keyof typeof legacyEditorialOperationSkillMap]
        : undefined;
}
