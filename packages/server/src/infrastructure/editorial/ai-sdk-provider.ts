import type { ModelMessage } from "ai";
import { AI_PROVIDER, type AiProvider, type ReasoningEffort } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";


export function responseId(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== "object" || !("openai" in metadata))
        return undefined;

    const openai = metadata.openai;
    if (!openai || typeof openai !== "object" || !("responseId" in openai))
        return undefined;

    return typeof openai.responseId === "string" ? openai.responseId : undefined;
}


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


export function responsesPrompt(messages: ModelMessage[]) {
    return {
        instructions: messages
            .filter((message) => message.role === "system")
            .map((message) => message.content)
            .join("\n\n"),
        messages: messages.filter((message) => message.role !== "system"),
    };
}


export function responsesProviderOptions(storeResponses: boolean, previousResponseId?: string, reasoningEffort?: ReasoningEffort) {
    return {
        openai: {
            store: storeResponses,
            ...(storeResponses && previousResponseId ? { previousResponseId } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
        },
    };
}


export type SupportingTextProviderOptions = ReturnType<typeof responsesProviderOptions> | undefined;


export function supportingTextProviderOptions(provider: AiProvider, reasoningEffort?: ReasoningEffort): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? responsesProviderOptions(false, undefined, reasoningEffort)
        : undefined;
}


export function editorialProviderOptions({ provider, storeResponses, previousResponseId, reasoningEffort }: { provider: AiProvider; storeResponses: boolean; previousResponseId?: string; reasoningEffort?: ReasoningEffort }): SupportingTextProviderOptions {
    return provider === AI_PROVIDER.OPENAI
        ? responsesProviderOptions(storeResponses, previousResponseId, reasoningEffort)
        : undefined;
}


export function continuationToken({ provider, storeResponses, metadata }: { provider: AiProvider; storeResponses: boolean; metadata: unknown }): string | undefined {
    return provider === AI_PROVIDER.OPENAI && storeResponses
        ? responseId(metadata)
        : undefined;
}
