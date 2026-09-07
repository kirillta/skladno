import {
    ApplicationClientError,
    type ApplicationErrorPayload,
    type AssistantEvent,
    HTTP_STATUS,
    isAssistantEvent,
} from "@skladno/shared";


export function applicationClientError(payload: unknown, status: number): ApplicationClientError {
    if (payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string") {
        const error = payload as ApplicationErrorPayload;
        return new ApplicationClientError(error.code, error.parameters, status);
    }

    return new ApplicationClientError("editorial_request_failed", { status }, status);
}


export function parseAssistantEvent(data: string): AssistantEvent {
    const event: unknown = JSON.parse(data);
    if (!isAssistantEvent(event))
        throw new ApplicationClientError("editorial_request_failed", undefined, HTTP_STATUS.INTERNAL_SERVER_ERROR);

    return event;
}


export async function streamEvents<Event>(body: ReadableStream<Uint8Array>, parse: (data: string) => Event, onEvent: (event: Event) => void): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
            const data = message.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
            if (data)
                onEvent(parse(data));
        }

        if (done)
            return;
    }
}
