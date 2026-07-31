import { ChatPromptTemplate } from "@langchain/core/prompts";
import { EDITORIAL_OPERATION, type EditorialOperation, type StyleProfile } from "@skladno/shared";


interface EditorialPromptInput {
    operation: EditorialOperation;
    article: string;
    authorContext: string;
    styleProfile?: StyleProfile;
    targetLanguage?: string;
}


const commonGuardrails = "Preserve the author's claims, numbers, URLs, code, technical terms, requested tone, intent, and existing Markdown formatting. Do not invent facts, examples, or sources. Return only a valid Markdown proposed full-text article. This is a proposal for author review; never say that you saved or changed the article.";


const thesisTemplate = ChatPromptTemplate.fromMessages([
    ["system", `You are an editorial assistant. ${commonGuardrails}`],
    ["human", "Workflow: thesis to narrative. Turn the current article text into a coherent technical-article narrative. Keep the author's meaning and make the structure clear without adding unsupported material.\n\nCurrent article:\n{article}\n\nAuthor guidance or theses:\n{authorContext}"],
]);


const flowTemplate = ChatPromptTemplate.fromMessages([
    ["system", `You are an editorial assistant. ${commonGuardrails}`],
    ["human", "Workflow: flow revision. Revise the current article as a complete article to improve structure, transitions, and readability. Keep its meaning intact; do not summarize it or turn it into feedback.\n\nCurrent article:\n{article}\n\nAuthor guidance:\n{authorContext}"],
]);


const styleTemplate = ChatPromptTemplate.fromMessages([
    ["system", `You are an editorial assistant. ${commonGuardrails}`],
    ["human", "Workflow: style review. Compare the current draft against this compact, locally derived author-style profile. The raw corpus is not available to you. Identify only concrete, material divergences. Produce a conservative full-text proposal that addresses those divergences; do not make changes merely to imitate superficial habits. Each finding must cite one or more supplied trait IDs.\n\nCurrent article:\n{article}\n\nCorpus confidence: {confidence}\n\nSupplied corpus traits:\n{traits}\n\nAuthor guidance:\n{authorContext}"],
]);


const translationTemplate = ChatPromptTemplate.fromMessages([
    ["system", "You are a technical translator. Translate faithfully without changing claims, numbers, intended voice, or Markdown formatting. Return valid Markdown. Tokens in the form [[SKLADNO_PROTECTED_N]] are protected code, URLs, or technical names: copy every token exactly once and do not translate it. This is a proposal for author review; never say that you saved or changed the article."],
    ["human", "Workflow: translation. Translate the complete article into {targetLanguage}. Return the translation and metadata through the requested structured response.\n\nCurrent article:\n{article}\n\nAuthor guidance:\n{authorContext}"],
]);


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


export async function createEditorialMessages(input: EditorialPromptInput) {
    const values = {
        article: input.article,
        authorContext: authorGuidance(input.authorContext),
    };

    if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)
        return thesisTemplate.formatMessages(values);

    if (input.operation === EDITORIAL_OPERATION.STYLE_REVIEW) {
        if (!input.styleProfile)
            throw new Error("Add at least one style corpus item before checking style.");

        return styleTemplate.formatMessages({
            ...values,
            confidence: `${input.styleProfile.confidence} (${input.styleProfile.corpusItemCount} item(s), ${input.styleProfile.characterCount} characters). Treat low confidence as tentative.`,
            traits: styleTraits(input.styleProfile),
        });
    }

    if (input.operation === EDITORIAL_OPERATION.TRANSLATION) {
        if (!input.targetLanguage?.trim())
            throw new Error("Choose a target language before requesting a translation.");

        return translationTemplate.formatMessages({
            ...values,
            targetLanguage: input.targetLanguage.trim(),
        });
    }

    return flowTemplate.formatMessages(values);
}
