import { EDITORIAL_OPERATION, type EditorialOperation, type StyleProfile } from "@skladno/shared";


export function isEditorialOperation(value: string): value is EditorialOperation {
    return Object.values(EDITORIAL_OPERATION).includes(value as EditorialOperation);
}


function authorGuidance(authorContext: string): string {
    return authorContext.trim() || "No additional author guidance was provided.";
}


function commonGuardrails(): string {
    return "Preserve the author's claims, numbers, URLs, code, technical terms, requested tone, and intent. Do not invent facts, examples, or sources. Return only a proposed full-text article. This is a proposal for author review; never say that you saved or changed the article.";
}


function thesisToNarrativePrompt(guidance: string): string {
    return `Workflow: thesis to narrative. Turn the selected document text into a coherent technical-article narrative. Keep the author's meaning and make the structure clear without adding unsupported material. ${commonGuardrails()}\n\nAuthor guidance or theses:\n${guidance}`;
}


function flowRevisionPrompt(guidance: string): string {
    return `Workflow: flow revision. Revise the selected draft as a complete article to improve structure, transitions, and readability. Keep its meaning intact; do not summarize it or turn it into feedback. ${commonGuardrails()}\n\nAuthor guidance:\n${guidance}`;
}


function styleTraits(profile: StyleProfile): string {
    return profile.traits
        .map((trait) => `- ${trait.id}: ${trait.label} (${trait.evidence})`)
        .join("\n");
}


function styleReviewPrompt(profile: StyleProfile, guidance: string): string {
    const responseShape = "{\"proposal\":\"complete proposed article\",\"findings\":[{\"divergence\":\"specific difference in this draft\",\"suggestion\":\"what the proposal changes and why\",\"traitIds\":[\"profile trait id\"]}]}";
    const workflow = "Workflow: style review. Compare the current draft against this compact, locally derived author-style profile. The raw corpus is not available to you. Identify only concrete, material divergences. Produce a conservative full-text proposal that addresses those divergences; do not make changes merely to imitate superficial habits.";
    const responseInstructions = `Return valid JSON only, with exactly this shape: ${responseShape}. Each finding must cite one or more supplied trait IDs.`;
    const confidence = `Corpus confidence: ${profile.confidence} (${profile.corpusItemCount} item(s), ${profile.characterCount} characters). Treat low confidence as tentative.`;

    return `${workflow} ${responseInstructions} ${commonGuardrails()}\n\n${confidence}\n\nSupplied corpus traits:\n${styleTraits(profile)}\n\nAuthor guidance:\n${guidance}`;
}


export function createEditorialPrompt(operation: EditorialOperation, authorContext: string, styleProfile?: StyleProfile): string {
    const guidance = authorGuidance(authorContext);

    if (operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)
        return thesisToNarrativePrompt(guidance);

    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW) {
        if (!styleProfile)
            throw new Error("Add at least one style corpus item before checking style.");

        return styleReviewPrompt(styleProfile, guidance);
    }

    return flowRevisionPrompt(guidance);
}
