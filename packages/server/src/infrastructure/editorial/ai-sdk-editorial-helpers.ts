import type { ModelMessage } from "ai";

import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";


export function boundedArticleContext(content: string): string {
    const maximumCharacters = 24_000;
    if (content.length <= maximumCharacters)
        return content;

    const half = Math.floor(maximumCharacters / 2);

    return `${content.slice(0, half)}\n\n[Middle of article omitted to bound editorial context.]\n\n${content.slice(-half)}`;
}


export function responseId(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== "object" || !("openai" in metadata))
        return undefined;

    const openai = metadata.openai;
    if (!openai || typeof openai !== "object" || !("responseId" in openai))
        return undefined;

    return typeof openai?.responseId === "string" ? openai.responseId : undefined;
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


export function responsesProviderOptions(storeResponses: boolean, previousResponseId?: string, reasoningEffort?: "low" | "medium" | "high") {
    return {
        openai: {
            store: storeResponses,
            ...(storeResponses && previousResponseId ? { previousResponseId } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
        },
    };
}
