import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { APPLICATION_ERROR, AI_PROVIDER, HTTP_STATUS, type AiProvider } from "@skladno/shared";
import type { LanguageModel } from "ai";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";


export interface ProviderModelConfiguration {
    provider: AiProvider;
    apiKey: string;
    model: string;
}


// TODO: why do we use Zen for all models? We should use the provider's base URL for each provider instead of hardcoding Zen's base URL.
const zenBaseUrl = "https://opencode.ai/zen/v1";


function zenModelId(model: string): string {
    return model.startsWith("opencode/") ? model.slice("opencode/".length) : model;
}


function unsupportedZenModel(): never {
    throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);
}


function createZenModel(config: ProviderModelConfiguration): LanguageModel {
    const model = zenModelId(config.model);
    if (model.startsWith("gpt-") || model.startsWith("grok-") || model.startsWith("muse-spark"))
        return createOpenAI({ apiKey: config.apiKey, baseURL: zenBaseUrl }).responses(model);

    if (model.startsWith("claude-") || model.startsWith("qwen"))
        return createAnthropic({ apiKey: config.apiKey, baseURL: zenBaseUrl }).messages(model);

    if (model.startsWith("gemini-"))
        return createGoogle({ apiKey: config.apiKey, baseURL: zenBaseUrl })(model);

    if (["deepseek", "minimax", "glm", "kimi", "big-pickle", "mimo", "ling", "nemotron"].some((prefix) => model.startsWith(prefix)))
        return createOpenAICompatible({ apiKey: config.apiKey, baseURL: zenBaseUrl, name: "opencode" })(model);

    return unsupportedZenModel();
}


export function createProviderModel(config: ProviderModelConfiguration): LanguageModel {
    switch (config.provider) {
        case AI_PROVIDER.OPENAI:
            return createOpenAI({ apiKey: config.apiKey }).responses(config.model);
        case AI_PROVIDER.OPENCODE:
            return createZenModel(config);
        case AI_PROVIDER.ANTHROPIC:
            return createAnthropic({ apiKey: config.apiKey })(config.model);
        case AI_PROVIDER.GOOGLE:
            return createGoogle({ apiKey: config.apiKey })(config.model);
        case AI_PROVIDER.XAI:
            return createXai({ apiKey: config.apiKey }).responses(config.model);
        case AI_PROVIDER.DEEPSEEK:
            return createDeepSeek({ apiKey: config.apiKey })(config.model);
        default: {
            const _exhaustive: never = config.provider;
            return _exhaustive;
        }
    }
}
