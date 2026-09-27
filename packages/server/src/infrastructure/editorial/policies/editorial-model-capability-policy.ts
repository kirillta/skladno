import { AI_PROVIDER, EDITORIAL_OPERATION, type AiProvider, type EditorialOperation } from "@skladno/shared";


export interface EditorialModelCapabilities {
    basicTextGeneration: boolean;
    structuredOutput: boolean;
    sourcedResearch: boolean;
}


export class EditorialModelCapabilityPolicy {
    getCapabilities(provider: AiProvider, model: string): EditorialModelCapabilities {
        const structuredOutput = this.isKnownStructuredModel(provider, model);

        return {
            basicTextGeneration: Boolean(model.trim()),
            structuredOutput,
            sourcedResearch: structuredOutput && (provider === AI_PROVIDER.OPENAI || provider === AI_PROVIDER.ANTHROPIC || provider === AI_PROVIDER.GOOGLE || provider === AI_PROVIDER.XAI),
        };
    }


    /** Discovery never proves operation support; manual model IDs may use only basic text generation. */
    supportsOperation(provider: AiProvider, model: string, operation: EditorialOperation): boolean {
        const capabilities = this.getCapabilities(provider, model);
        if (operation === EDITORIAL_OPERATION.FACT_CHECK)
            return capabilities.sourcedResearch;

        if (operation === EDITORIAL_OPERATION.STYLE_REVIEW || operation === EDITORIAL_OPERATION.TRANSLATION)
            return capabilities.structuredOutput;

        return capabilities.basicTextGeneration;
    }


    private isKnownStructuredModel(provider: AiProvider, model: string): boolean {
        const id = model.replace(/^opencode\//, "");

        switch (provider) {
            case AI_PROVIDER.OPENAI:
                return /^(gpt|o\d)/.test(id);
            case AI_PROVIDER.ANTHROPIC:
                return id.startsWith("claude-");
            case AI_PROVIDER.GOOGLE:
                return id.startsWith("gemini-");
            case AI_PROVIDER.XAI:
                return id.startsWith("grok-");
            case AI_PROVIDER.DEEPSEEK:
                return id.startsWith("deepseek-");
            default:
                return /^(gpt-|grok-|claude-|gemini-|deepseek-)/.test(id);
        }
    }
}
