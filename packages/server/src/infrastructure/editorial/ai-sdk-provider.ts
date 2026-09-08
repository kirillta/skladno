import { AI_PROVIDER, type AiProvider, type ReasoningEffort } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { openAiResponseId, openAiResponsesProviderOptions, type OpenAiResponsesProviderOptions } from "./openai-responses.js";


export function providerError(error: unknown, hadPreviousResponseId: boolean): EditorialEngineError {
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


export function supportingTextProviderOptions(provider: AiProvider, reasoningEffort?: ReasoningEffort): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? openAiResponsesProviderOptions(false, undefined, reasoningEffort)
        : undefined;
}


export function editorialProviderOptions({ provider, storeResponses, previousResponseId, reasoningEffort }: { provider: AiProvider; storeResponses: boolean; previousResponseId?: string; reasoningEffort?: ReasoningEffort }): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? openAiResponsesProviderOptions(storeResponses, previousResponseId, reasoningEffort)
        : undefined;
}


export function continuationToken({ provider, storeResponses, metadata }: { provider: AiProvider; storeResponses: boolean; metadata: unknown }): string | undefined {
    return provider === AI_PROVIDER.OPENAI && storeResponses
        ? openAiResponseId(metadata)
        : undefined;
}
