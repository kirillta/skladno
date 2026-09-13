import type { LanguageModel } from "ai";
import { AI_PROVIDER, type AiProvider, type ReasoningEffort } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { getOpenAiResponseId, getOpenAiResponsesProviderOptions, type OpenAiResponsesProviderOptions } from "./openai-responses.js";


export function createProviderError(error: unknown, hadPreviousResponseId: boolean): EditorialEngineError {
    const message = error instanceof Error ? error.message : EDITORIAL_ENGINE_ERROR.PROVIDER;
    if (hadPreviousResponseId && /previous[_ ]response|response.*not found|not found/i.test(message))
        return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED, EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED);

    if (/network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(message))
        return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.NETWORK, EDITORIAL_ENGINE_ERROR.NETWORK);

    return new EditorialEngineError(EDITORIAL_ENGINE_ERROR.PROVIDER, message);
}


export function isAcceptedFinish(reason: string): boolean {
    return reason === "stop" || reason === "tool-calls";
}


export type SupportingTextProviderOptions = OpenAiResponsesProviderOptions | undefined;


export function createAiSdkGenerationOptions({ model, signal, providerOptions }: { model: LanguageModel; signal: AbortSignal; providerOptions?: SupportingTextProviderOptions }) {
    return {
        model,
        abortSignal: signal,
        telemetry: { isEnabled: false },
        providerOptions,
    };
}


export function getSupportingTextProviderOptions(provider: AiProvider, reasoningEffort?: ReasoningEffort): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? getOpenAiResponsesProviderOptions(false, undefined, reasoningEffort)
        : undefined;
}


export function getEditorialProviderOptions({ provider, storeResponses, previousResponseId, reasoningEffort }: { provider: AiProvider; storeResponses: boolean; previousResponseId?: string; reasoningEffort?: ReasoningEffort }): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? getOpenAiResponsesProviderOptions(storeResponses, previousResponseId, reasoningEffort)
        : undefined;
}


export function getContinuationToken({ provider, storeResponses, metadata }: { provider: AiProvider; storeResponses: boolean; metadata: unknown }): string | undefined {
    return provider === AI_PROVIDER.OPENAI && storeResponses
        ? getOpenAiResponseId(metadata)
        : undefined;
}
