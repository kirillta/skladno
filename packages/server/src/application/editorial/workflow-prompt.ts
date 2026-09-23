import type { ModelMessage } from "ai";
import { APPLICATION_ERROR, BUILT_IN_SKILL, EDITORIAL_OPERATION, HTTP_STATUS, resolveBuiltInSkillId, type BuiltInSkillId, type EditorialOperation, type StyleProfile } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import { getBuiltInSkillInstructions } from "../assistant/skills/get-built-in-skill-instructions.js";


interface EditorialPromptInput {
    operation: EditorialOperation;
    article: string;
    articleTitle?: string;
    articleSelection?: boolean;
    authorContext: string;
    skillId?: BuiltInSkillId;
    surroundingArticleCharacterCount?: number;
    styleProfile?: StyleProfile;
    articleStyleRules?: string;
    targetArticleCharacterLimit?: number;
    targetLanguage?: string;
}


export const authorControlInstruction = "Do not claim that you saved or changed the Article.";


function getSkillInstructions(input: EditorialPromptInput): string {
    const skillId = input.skillId ?? resolveBuiltInSkillId(input.operation);
    if (!skillId)
        throw new Error("invalid_builtin_skill_package");

    return getBuiltInSkillInstructions(skillId);
}


function createAuthorGuidance(authorContext: string): string {
    return authorContext.trim() || "No additional author guidance was provided.";
}


function formatStyleTraits(profile: StyleProfile): string {
    return profile.traits
        .map((trait) => `- ${trait.id}: ${trait.label} (${trait.evidence})`)
        .join("\n");
}


function formatNumberedRules(rules: string, prefix: string): string {
    return rules.split("\n").map((rule) => rule.trim()).filter(Boolean).map((rule, index) => `- ${prefix}-${index + 1}: ${rule}`).join("\n") || "None.";
}


export function isEditorialOperation(value: string): value is EditorialOperation {
    return Object.values(EDITORIAL_OPERATION).includes(value as EditorialOperation);
}


function createTalkingPointsPrompt(input: EditorialPromptInput): ModelMessage[] {
    const authorMessage = input.authorContext.trim();
    const source = input.articleSelection ? input.article.trim() : authorMessage || input.article.trim();
    let sourceLabel = "Article content";
    if (authorMessage)
        sourceLabel = "Author's message";

    if (input.articleSelection)
        sourceLabel = "Article selection";

    const guidance = input.articleSelection && authorMessage
        ? `\n\nAuthor message (supplementary direction or material that may extend the selection):\n${authorMessage}`
        : "";

    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `${sourceLabel}:\n${source || "No source content was provided."}${guidance}`
        },
    ];
}


function createNarrativeDraftPrompt(input: EditorialPromptInput): ModelMessage[] {
    const authorMessage = input.authorContext.trim();
    const sourceLabel = input.articleSelection ? "Article selection" : "Article content";
    const authorDirection = authorMessage ? `\n\nAuthor message (highest-priority direction and supplementary material):\n${authorMessage}` : "";
    const lengthHint = input.targetArticleCharacterLimit
        ? `\n\nAdvisory target for the resulting complete Article: about ${input.targetArticleCharacterLimit} characters. This is a composition hint, not a hard limit on your response.${input.articleSelection ? ` The unchanged surrounding Article currently contains ${input.surroundingArticleCharacterCount ?? 0} characters; size this replacement with the complete Article in mind.` : ""}`
        : "";
    const outputFormat = input.articleSelection
        ? "Selected-passage Markdown replacement."
        : "Full Article Markdown proposal.";

    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `Output format:\n${outputFormat}\n\n${sourceLabel}:\n${input.article.trim() || "No Article content was provided."}${authorDirection}${lengthHint}`
        },
    ];
}


function createThesisToNarrativePrompt(input: EditorialPromptInput): ModelMessage[] {
    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `Current article:\n${input.article}\n\nAuthor guidance or theses:\n${createAuthorGuidance(input.authorContext)}`
        },
    ];
}


function createStyleReviewPrompt(input: EditorialPromptInput): ModelMessage[] {
    if (!input.styleProfile)
        throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `Current article:\n${input.article}\n\nCorpus confidence: ${input.styleProfile.confidence} (${input.styleProfile.corpusItemCount} item(s), ${input.styleProfile.characterCount} characters).\n\nSupplied corpus traits:\n${formatStyleTraits(input.styleProfile)}\n\nGlobal rules:\n${formatNumberedRules(input.styleProfile.rules, "global-rule")}\n\nThis Article rules:\n${formatNumberedRules(input.articleStyleRules ?? "", "article-rule")}\n\nAuthor guidance:\n${createAuthorGuidance(input.authorContext)}`
        },
    ];
}


function createTranslationPrompt(input: EditorialPromptInput): ModelMessage[] {
    if (!input.targetLanguage?.trim())
        throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `Target language:\n${input.targetLanguage.trim()}\n\nCurrent Article title:\n${input.articleTitle ?? ""}\n\nCurrent article:\n${input.article}\n\nAuthor guidance:\n${createAuthorGuidance(input.authorContext)}`
        },
    ];
}


function createFlowRevisionPrompt(input: EditorialPromptInput): ModelMessage[] {
    return [
        {
            role: "system",
            content: getSkillInstructions(input)
        },
        {
            role: "user",
            content: `Current article:\n${input.article}\n\nAuthor guidance:\n${createAuthorGuidance(input.authorContext)}`
        },
    ];
}


export function createEditorialMessages(input: EditorialPromptInput): ModelMessage[] {
    if (input.skillId === BUILT_IN_SKILL.TALKING_POINTS)
        return createTalkingPointsPrompt(input);

    if (input.skillId === BUILT_IN_SKILL.NARRATIVE_DRAFT)
        return createNarrativeDraftPrompt(input);

    if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)
        return createThesisToNarrativePrompt(input);

    if (input.operation === EDITORIAL_OPERATION.STYLE_REVIEW)
        return createStyleReviewPrompt(input);

    if (input.operation === EDITORIAL_OPERATION.TRANSLATION)
        return createTranslationPrompt(input);

    return createFlowRevisionPrompt(input);
}
