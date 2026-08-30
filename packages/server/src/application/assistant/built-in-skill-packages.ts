import { BUILT_IN_SKILL, type AssistantSkillReference, type AssistantSkillSummary, type BuiltInSkillId } from "@skladno/shared";


export interface AssistantSkillPackage {
    reference: AssistantSkillReference;
    name: string;
    description: string;
    instructions: string;
    references?: readonly string[];
}


function skill(id: BuiltInSkillId, name: string, description: string, instructions: string, references?: readonly string[]): AssistantSkillPackage {
    return {
        reference: { source: "built-in", id, version: "1" },
        name,
        description,
        instructions,
        ...(references?.length ? { references } : {}),
    };
}


export const builtInSkillPackages: readonly AssistantSkillPackage[] = [
    skill(BUILT_IN_SKILL.TALKING_POINTS, "Talking Points", "Develop 3–5 grounded theses from author-provided material.", "# Talking Points\n\nPrioritize selected text, then the Author's request, then the current Article. Preserve claims and ask a focused question when direction is unclear."),
    skill(BUILT_IN_SKILL.NARRATIVE_DRAFT, "Narrative Draft", "Develop the Author's material into a reviewable narrative Proposal.", "# Narrative Draft\n\nDevelop only supplied ideas. Preserve claims, numbers, URLs, code, technical terms, and author voice. Produce a Proposal for Author review, never a direct Article change."),
    skill(BUILT_IN_SKILL.FLOW_AND_CLARITY, "Flow and Clarity", "Prepare a full-text Proposal that improves coherence and readability.", "# Flow and Clarity\n\nKeep the Article's meaning and voice. Improve transitions and structure conservatively. Return a complete Proposal rather than commentary.", ["Generated text remains separate until the Author explicitly approves it."]),
    skill(BUILT_IN_SKILL.FACT_CHECKING, "Fact Checking", "Review factual claims and prepare sourced, advisory Findings.", "# Fact Checking\n\nCheck factual claims with sources. Keep uncertainty visible and never alter the Article.", ["Findings are advisory and tied to the reviewed Revision."]),
    skill(BUILT_IN_SKILL.STYLE_REVIEW, "Style Review", "Review the Article against its prepared Style Profile.", "# Style Review\n\nUse the prepared Style Profile and Article-specific rules. Keep raw style samples private and return reviewable Findings with any related Proposal.", ["A Style Profile must be ready before review."]),
    skill(BUILT_IN_SKILL.TRANSLATION, "Translation", "Prepare a complete translation Proposal in a selected language.", "# Translation\n\nTranslate the complete Article into the selected language. Preserve claims, numbers, URLs, code, technical terms, and author voice.", ["A target language is required."]),
];


export function builtInSkillSummary(skillPackage: AssistantSkillPackage): AssistantSkillSummary {
    return { reference: skillPackage.reference, name: skillPackage.name, description: skillPackage.description };
}
