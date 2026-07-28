import { HTTP_METHOD, type EditorialEvent } from "@skladno/shared";


export interface EditorialProviderRequest {
    model: string;
    prompt: string;
    article: string;
    previousResponseId?: string;
}


export const PROVIDER_STREAM_EVENT = {
    TEXT_DELTA: "text_delta",
    TOOL_STATUS: "tool_status",
    COMPLETED: "completed",
} as const;


export type ProviderStreamEvent =
    | { type: typeof PROVIDER_STREAM_EVENT.TEXT_DELTA; delta: string }
    | { type: typeof PROVIDER_STREAM_EVENT.TOOL_STATUS; tool: string; status: "started" | "completed" }
    | { type: typeof PROVIDER_STREAM_EVENT.COMPLETED; responseId: string; text: string };


export interface EditorialProvider {
    stream(request: EditorialProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent>;
}


function providerError(response: Response): Error {
    return new Error(`OpenAI could not complete this request (${response.status}). Check your connection and API settings, then retry.`);
}


function asObject(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}


export class OpenAiResponsesProvider implements EditorialProvider {
    constructor(private readonly apiKey: string) { }

    async *stream(request: EditorialProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamEvent> {
        const response = await fetch("https://api.openai.com/v1/responses", {
            method: HTTP_METHOD.POST,
            headers: {
                authorization: `Bearer ${this.apiKey}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: request.model,
                stream: true,
                store: false,
                ...(request.previousResponseId ? { previous_response_id: request.previousResponseId } : {}),
                input: [
                    {
                        role: "developer",
                        content: "You are an editorial assistant. Return a proposal only; never imply that you changed the article.",
                    },
                    {
                        role: "user",
                        content: `Current article:\n${request.article}\n\nEditorial request:\n${request.prompt}`,
                    },
                ],
            }),
            signal,
        });

        if (!response.ok)
            throw providerError(response);

        if (!response.body)
            throw new Error("OpenAI returned an empty stream. Retry the request.");

        let buffer = "";
        let text = "";
        let completed = false;

        for await (const chunk of response.body) {
            buffer += new TextDecoder().decode(chunk, { stream: true });
            const messages = buffer.split("\n\n");
            buffer = messages.pop() ?? "";

            for (const message of messages) {
                const data = message.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
                if (!data || data === "[DONE]")
                    continue;

                let event: Record<string, unknown> | undefined;
                try {
                    event = asObject(JSON.parse(data));
                } catch {
                    throw new Error("OpenAI sent an unreadable stream event. Retry the request.");
                }

                if (!event || typeof event.type !== "string")
                    throw new Error("OpenAI sent an invalid stream event. Retry the request.");

                if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                    text += event.delta;
                    yield { type: PROVIDER_STREAM_EVENT.TEXT_DELTA, delta: event.delta };
                } else if (event.type === "response.web_search_call.in_progress") {
                    yield { type: PROVIDER_STREAM_EVENT.TOOL_STATUS, tool: "web_search", status: "started" };
                } else if (event.type === "response.web_search_call.completed") {
                    yield { type: PROVIDER_STREAM_EVENT.TOOL_STATUS, tool: "web_search", status: "completed" };
                } else if (event.type === "response.completed") {
                    const completedResponse = asObject(event.response);
                    if (!completedResponse || typeof completedResponse.id !== "string")
                        throw new Error("OpenAI completed without a response ID. Retry the request.");

                    completed = true;
                    yield { type: PROVIDER_STREAM_EVENT.COMPLETED, responseId: completedResponse.id, text };
                } else if (event.type === "error" || event.type === "response.failed") {
                    throw new Error("OpenAI could not complete this request. Retry it in a moment.");
                }
            }
        }

        if (!completed)
            throw new Error("OpenAI ended before completing the proposal. Retry the request.");
    }
}


export function writeEditorialEvent(response: import("node:http").ServerResponse, event: EditorialEvent): void {
    response.write(`event: editorial\ndata: ${JSON.stringify(event)}\n\n`);
}


export function requestAbortedSignal(
    request: import("node:http").IncomingMessage,
    response: import("node:http").ServerResponse,
): AbortSignal {
    const controller = new AbortController();
    request.once("aborted", () => controller.abort());
    request.once("close", () => {
        if (!request.complete)
            controller.abort();
    });
    
    response.once("close", () => controller.abort());

    return controller.signal;
}
