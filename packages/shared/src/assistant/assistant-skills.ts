export const BUILT_IN_SKILL = {
    TALKING_POINTS: "talking_points",
    NARRATIVE_DRAFT: "narrative_draft",
    FLOW_AND_CLARITY: "flow_and_clarity",
    FACT_CHECKING: "fact_checking",
    STYLE_REVIEW: "style_review",
    TRANSLATION: "translation",
    SKILL_CREATOR: "skill_creator",
} as const;

export type BuiltInSkillId = typeof BUILT_IN_SKILL[keyof typeof BUILT_IN_SKILL];

export const builtInSkills: readonly BuiltInSkillId[] = [
    BUILT_IN_SKILL.TALKING_POINTS,
    BUILT_IN_SKILL.NARRATIVE_DRAFT,
    BUILT_IN_SKILL.FLOW_AND_CLARITY,
    BUILT_IN_SKILL.FACT_CHECKING,
    BUILT_IN_SKILL.STYLE_REVIEW,
    BUILT_IN_SKILL.TRANSLATION,
    BUILT_IN_SKILL.SKILL_CREATOR,
];

export const builtInSkillScopeCompatibility: Record<BuiltInSkillId, readonly ("article" | "selection")[]> = {
    talking_points: ["article", "selection"],
    narrative_draft: ["article", "selection"],
    flow_and_clarity: ["article", "selection"],
    fact_checking: ["article", "selection"],
    style_review: ["article", "selection"],
    translation: ["article"],
    skill_creator: ["article", "selection"],
};


export function isBuiltInSkillId(value: unknown): value is BuiltInSkillId {
    return typeof value === "string" && builtInSkills.includes(value as BuiltInSkillId);
}


export const editorialOperationSkillMap = {
    thesis_to_narrative: BUILT_IN_SKILL.NARRATIVE_DRAFT,
    flow_revision: BUILT_IN_SKILL.FLOW_AND_CLARITY,
    fact_check: BUILT_IN_SKILL.FACT_CHECKING,
    style_review: BUILT_IN_SKILL.STYLE_REVIEW,
    translation: BUILT_IN_SKILL.TRANSLATION,
} as const;
