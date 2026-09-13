import type { ReasoningEffort } from "@skladno/shared";


export function getOpenAiResponseId(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== "object" || !("openai" in metadata))
        return undefined;

    const openai = metadata.openai;
    if (!openai || typeof openai !== "object" || !("responseId" in openai))
        return undefined;

    return typeof openai.responseId === "string" ? openai.responseId : undefined;
}


export function getOpenAiResponsesProviderOptions(storeResponses: boolean, previousResponseId?: string, reasoningEffort?: ReasoningEffort) {
    return {
        openai: {
            store: storeResponses,
            ...(storeResponses && previousResponseId ? { previousResponseId } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
        },
    };
}


export type OpenAiResponsesProviderOptions = ReturnType<typeof getOpenAiResponsesProviderOptions>;
