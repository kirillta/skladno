import { AI_PROVIDER, type AiProvider } from "@skladno/shared";
import { createOpenAI } from "@ai-sdk/openai";

import type { EditorialEngine } from "../../../application/services/editorial/editorial-engine.js";
import { AiSdkEditorialEngine } from "./ai-sdk-editorial-engine.js";
import type { FactCheckProvider } from "../models/fact-check-provider.js";
import { createOpenAIFactCheckProvider } from "../adapters/openai-fact-check-provider.js";
import { createProviderModel } from "../adapters/provider-model.js";
import { openAiResponsesProviderOptions } from "../adapters/openai-responses.js";


function createFactCheckProvider(options: Parameters<typeof createEditorialEngine>[0]): FactCheckProvider | undefined {
    if (options.provider !== AI_PROVIDER.OPENAI || !options.sourcedResearch)
        return undefined;

    return createOpenAIFactCheckProvider({
        client: createOpenAI({ apiKey: options.apiKey }),
        model: options.model,
        providerOptions: (previousResponseId) => openAiResponsesProviderOptions(options.storeResponses, previousResponseId, options.reasoningEffort),
    });
}


export function createEditorialEngine(options: { apiKey: string; provider: AiProvider; model: string; storeResponses: boolean; sourcedResearch: boolean; connectionId?: string; reasoningEffort?: "low" | "medium" | "high" }): EditorialEngine {
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
