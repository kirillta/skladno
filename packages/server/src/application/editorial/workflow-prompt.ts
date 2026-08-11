import type { ModelMessage } from "ai";
import { BUILT_IN_SKILL, EDITORIAL_OPERATION, type BuiltInSkillId, type EditorialOperation, type StyleProfile } from "@skladno/shared";


interface EditorialPromptInput {
    operation: EditorialOperation;
    article: string;
    articleSelection?: boolean;
    authorContext: string;
    skillId?: BuiltInSkillId;
    styleProfile?: StyleProfile;
    targetLanguage?: string;
}


const commonGuardrails = "Preserve the author's claims, numbers, URLs, code, technical terms, requested tone, intent, and existing Markdown formatting. Do not invent facts, examples, or sources. Return only a valid Markdown proposed full-text article. This is a proposal for author review; never say that you saved or changed the article.";


function authorGuidance(authorContext: string): string {
    return authorContext.trim() || "No additional author guidance was provided.";
}


function styleTraits(profile: StyleProfile): string {
    return profile.traits
        .map((trait) => `- ${trait.id}: ${trait.label} (${trait.evidence})`)
        .join("\n");
}


export function isEditorialOperation(value: string): value is EditorialOperation {
    return Object.values(EDITORIAL_OPERATION).includes(value as EditorialOperation);
}


export function createEditorialMessages(input: EditorialPromptInput): ModelMessage[] {
    if (input.skillId === BUILT_IN_SKILL.TALKING_POINTS) {
        const authorMessage = input.authorContext.trim();
        const source = input.articleSelection ? input.article.trim() : authorMessage || input.article.trim();
        const sourceLabel = input.articleSelection ? "Article selection" : authorMessage ? "Author's message" : "Article content";
        const guidance = input.articleSelection && authorMessage ? `\n\nAuthor message (supplementary direction or material that may extend the selection):\n${authorMessage}` : "";

        return [
            { role: "system", content: "You are an editorial assistant helping an author discover an article's central theses. Preserve the author's intent, claims, numbers, URLs, code, and technical terms. Do not invent facts or say that you saved or changed the article." },
            { role: "user", content: `Workflow: talking points. Suggest concise, distinct theses from the source below. An Article selection is the primary source when present. The Author's message may guide or explicitly extend that selection; never use unselected whole Article content alongside it. Without a selection, prefer the Author's message whenever it is present; use Article content only when the message is empty. Unless the Author requests another count, suggest between 3 and 5 theses. Return a Markdown list. Base counts and derived details on the Article selection plus any supplementary material the Author explicitly provides in the message. If the source is missing or its direction is genuinely ambiguous, ask the Author only the focused questions needed to choose a direction instead of guessing.\n\n${sourceLabel}:\n${source || "No source content was provided."}${guidance}` },
        ];
    }

    if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)
        return [
            { role: "system", content: `You are an editorial assistant. ${commonGuardrails}` },
            { role: "user", content: `Workflow: thesis to narrative. Turn the current article text into a coherent technical-article narrative. Keep the author's meaning and make the structure clear without adding unsupported material.\n\nCurrent article:\n${input.article}\n\nAuthor guidance or theses:\n${authorGuidance(input.authorContext)}` },
        ];

    if (input.operation === EDITORIAL_OPERATION.STYLE_REVIEW) {
        if (!input.styleProfile)
            throw new Error("Add at least one style corpus item before checking style.");

        return [
            { role: "system", content: `You are an editorial assistant. ${commonGuardrails}` },
            { role: "user", content: `Workflow: style review. Compare the current draft against this compact, locally derived author-style profile. The raw corpus is not available to you. Identify only concrete, material divergences. Produce a conservative full-text proposal that addresses those divergences; do not make changes merely to imitate superficial habits. Each finding must cite one or more supplied trait IDs.\n\nCurrent article:\n${input.article}\n\nCorpus confidence: ${input.styleProfile.confidence} (${input.styleProfile.corpusItemCount} item(s), ${input.styleProfile.characterCount} characters). Treat low confidence as tentative.\n\nSupplied corpus traits:\n${styleTraits(input.styleProfile)}\n\nAuthor guidance:\n${authorGuidance(input.authorContext)}` },
        ];
    }

    if (input.operation === EDITORIAL_OPERATION.TRANSLATION) {
        if (!input.targetLanguage?.trim())
            throw new Error("Choose a target language before requesting a translation.");

        return [
            { role: "system", content: "You are a technical translator. Translate faithfully without changing claims, numbers, intended voice, or Markdown formatting. Return valid Markdown. Tokens in the form [[SKLADNO_PROTECTED_N]] are protected code, URLs, or technical names: copy every token exactly once and do not translate it. This is a proposal for author review; never say that you saved or changed the article." },
            { role: "user", content: `Workflow: translation. Translate the complete article into ${input.targetLanguage.trim()}. Return the translation and metadata through the requested structured response.\n\nCurrent article:\n${input.article}\n\nAuthor guidance:\n${authorGuidance(input.authorContext)}` },
        ];
    }

    return [
        { role: "system", content: `You are an editorial assistant. ${commonGuardrails}` },
        { role: "user", content: `Workflow: flow revision. Revise the current article as a complete article to improve structure, transitions, and readability. Keep its meaning intact; do not summarize it or turn it into feedback.\n\nCurrent article:\n${input.article}\n\nAuthor guidance:\n${authorGuidance(input.authorContext)}` },
    ];
}
