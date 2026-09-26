import { AI_PROVIDER, type AiProvider } from "@skladno/shared";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { generateText, type LanguageModel, type ToolSet } from "ai";

import type { EditorialEngine } from "../../../application/editorial/engine/editorial-engine.js";
import { AiSdkEditorialEngine } from "./ai-sdk-editorial-engine.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import { createOpenAIFactCheckProvider } from "../adapters/openai-fact-check-provider.js";
import { createProviderModel } from "../adapters/provider-model.js";
import { getOpenAiResponsesProviderOptions } from "../adapters/openai-responses.js";
import { createSourcedFactCheckProvider } from "../adapters/sourced-fact-check-provider.js";
import { createFactClaimMatcher } from "../adapters/fact-claim-matcher.js";
import { createAiSdkGenerationOptions, isAcceptedFinish } from "../adapters/ai-sdk-provider.js";
import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";


function createFactCheckProvider(options: Parameters<typeof createEditorialEngine>[0]): FactCheckProvider | undefined {
    if (!options.sourcedResearch)
        return undefined;

    let provider: FactCheckProvider;
    if (options.provider === AI_PROVIDER.OPENAI) {
        provider = createOpenAIFactCheckProvider({
            client: createOpenAI({ apiKey: options.apiKey }),
            model: options.model,
            providerOptions: (previousResponseId) => getOpenAiResponsesProviderOptions(options.storeResponses, previousResponseId, options.reasoningEffort),
        });
    } else {
        const model = createProviderModel(options);
        const research = createNativeResearch(options, model);
        if (!research)
            return undefined;

        provider = createSourcedFactCheckProvider(model, research);
    }

    return { ...provider, matchClaims: createFactClaimMatcher(options.matchModel ?? createProviderModel(options)) };
}


function createNativeResearch(options: Parameters<typeof createEditorialEngine>[0], model: LanguageModel): FactCheckProvider["researchClaims"] | undefined {
    if (options.provider === AI_PROVIDER.ANTHROPIC) {
        const tool = createAnthropic({ apiKey: options.apiKey }).tools.webSearch_20250305({ maxUses: 3 });
        return async (claims, instructions, signal) => researchClaims(claims, async (claim) => generateText({ ...createAiSdkGenerationOptions({ model, signal }), system: instructions, prompt: `Research this claim and identify dated sources:\n${claim}`, tools: { web_search: tool } as ToolSet }));
    }

    if (options.provider === AI_PROVIDER.GOOGLE) {
        const tool = createGoogle({ apiKey: options.apiKey }).tools.googleSearch({});
        return async (claims, instructions, signal) => researchClaims(claims, async (claim) => generateText({ ...createAiSdkGenerationOptions({ model, signal }), system: instructions, prompt: `Research this claim and identify dated sources:\n${claim}`, tools: { web_search: tool } as ToolSet }));
    }

    if (options.provider === AI_PROVIDER.XAI) {
        const tool = createXai({ apiKey: options.apiKey }).tools.webSearch();
        return async (claims, instructions, signal) => researchClaims(claims, async (claim) => generateText({ ...createAiSdkGenerationOptions({ model, signal }), system: instructions, prompt: `Research this claim and identify dated sources:\n${claim}`, tools: { web_search: tool } as ToolSet }));
    }

    return undefined;
}


async function researchClaims(claims: { claim: string }[], research: (claim: string) => Promise<{ text: string; sources: unknown; finishReason: string }>) {
    const results = [];
    for (const { claim } of claims) {
        const result = await research(claim);
        if (!isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        results.push({ claim, evidence: result.text, sources: result.sources });
    }

    return results;
}


export function createEditorialEngine(options: { apiKey: string; provider: AiProvider; model: string; storeResponses: boolean; sourcedResearch: boolean; connectionId?: string; reasoningEffort?: "low" | "medium" | "high"; matchModel?: LanguageModel }): EditorialEngine {
    const factCheckProvider = createFactCheckProvider(options);

    return new AiSdkEditorialEngine({
        provider: options.provider,
        languageModel: createProviderModel(options),
        factCheckProvider,
        storeResponses: options.storeResponses,
        reasoningEffort: options.reasoningEffort,
        ...(options.connectionId ? { continuationScope: { connectionId: options.connectionId, provider: options.provider, model: options.model } } : {}),
    });
}
