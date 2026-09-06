import type { AiProvider } from "@skladno/shared";

import type { EditorialEngine } from "../../application/ports/editorial-engine.js";
import { AiSdkEditorialEngine } from "./ai-sdk-editorial-engine.js";
import { createProviderModel } from "./provider-model.js";


export function createEditorialEngine(options: { apiKey: string; provider: AiProvider; model: string; storeResponses: boolean; sourcedResearch: boolean; connectionId?: string; reasoningEffort?: "low" | "medium" | "high" }): EditorialEngine {
    return new AiSdkEditorialEngine({
        ...options,
        languageModel: createProviderModel(options),
        ...(options.connectionId ? { continuationScope: { connectionId: options.connectionId, provider: options.provider, model: options.model } } : {}),
    });
}
