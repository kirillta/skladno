import type { ReasoningEffort } from "@skladno/shared";


export function openAiResponseId(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== "object" || !("openai" in metadata))
        return undefined;

    const openai = metadata.openai;
    if (!openai || typeof openai !== "object" || !("responseId" in openai))
        return undefined;

    return typeof openai.responseId === "string" ? openai.responseId : undefined;
}


export function openAiResponsesProviderOptions(storeResponses: boolean, previousResponseId?: string, reasoningEffort?: ReasoningEffort) {
    return {
        openai: {
            store: storeResponses,
            ...(storeResponses && previousResponseId ? { previousResponseId } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
        },
    };
}


export type OpenAiResponsesProviderOptions = ReturnType<typeof openAiResponsesProviderOptions>;
