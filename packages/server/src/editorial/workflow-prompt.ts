import { EDITORIAL_OPERATION, type EditorialOperation } from "@skladno/shared";


export function isEditorialOperation(value: string): value is EditorialOperation {
    return Object.values(EDITORIAL_OPERATION).includes(value as EditorialOperation);
}


export function createEditorialPrompt(operation: EditorialOperation, authorContext: string): string {
    const commonGuardrails = "Preserve the author's claims, numbers, URLs, code, technical terms, requested tone, and intent. Do not invent facts, examples, or sources. Return only a proposed full-text article. This is a proposal for author review; never say that you saved or changed the article.";
    const guidance = authorContext.trim() || "No additional author guidance was provided.";

    if (operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)
        return `Workflow: thesis to narrative. Turn the selected document text into a coherent technical-article narrative. Keep the author's meaning and make the structure clear without adding unsupported material. ${commonGuardrails}\n\nAuthor guidance or theses:\n${guidance}`;

    return `Workflow: flow revision. Revise the selected draft as a complete article to improve structure, transitions, and readability. Keep its meaning intact; do not summarize it or turn it into feedback. ${commonGuardrails}\n\nAuthor guidance:\n${guidance}`;
}
