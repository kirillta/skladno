import { AI_PROVIDER, EDITORIAL_OPERATION, type AiProvider, type EditorialOperation } from "@skladno/shared";


export interface EditorialModelCapabilities {
    basicTextGeneration: boolean;
    structuredOutput: boolean;
    sourcedResearch: boolean;
}


function knownStructuredModel(provider: AiProvider, model: string): boolean {
    const id = model.replace(/^opencode\//, "");

    if (provider === AI_PROVIDER.OPENAI)
        return /^(gpt|o\d)/.test(id);

    if (provider === AI_PROVIDER.ANTHROPIC)
        return id.startsWith("claude-");

    if (provider === AI_PROVIDER.GOOGLE)
        return id.startsWith("gemini-");

    if (provider === AI_PROVIDER.XAI)
        return id.startsWith("grok-");

    if (provider === AI_PROVIDER.DEEPSEEK)
        return id.startsWith("deepseek-");

    return /^(gpt-|grok-|claude-|gemini-|deepseek-)/.test(id);
}


export function editorialModelCapabilities(provider: AiProvider, model: string): EditorialModelCapabilities {
    const structuredOutput = knownStructuredModel(provider, model);

    return {
        basicTextGeneration: Boolean(model.trim()),
        structuredOutput,
        sourcedResearch: provider === AI_PROVIDER.OPENAI && structuredOutput,
    };
}


/** Discovery never proves operation support; manual model IDs may use only basic text generation. */
export function supportsEditorialOperation(provider: AiProvider, model: string, operation: EditorialOperation): boolean {
    const capabilities = editorialModelCapabilities(provider, model);
    if (operation === EDITORIAL_OPERATION.FACT_CHECK)
        return capabilities.sourcedResearch;

    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW || operation === EDITORIAL_OPERATION.TRANSLATION)
        return capabilities.structuredOutput;

    return capabilities.basicTextGeneration;
}
