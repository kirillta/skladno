import type { IncomingMessage, ServerResponse } from "node:http";
import { HTTP_METHOD, HTTP_STATUS, type EditorialEvent } from "@skladno/shared";

import type { ServerConfig } from "../../config.js";
import { PROVIDER_STREAM_EVENT, requestAbortedSignal, writeEditorialEvent, type EditorialProvider } from "../../editorial/openai-responses-provider.js";
import { Repositories } from "../../persistence/index.js";
import { object, readJson, string } from "../json.js";


function errorEvent(requestId: string, code: Extract<EditorialEvent, { type: "error" }>["code"], message: string, retryable: boolean): EditorialEvent {
    return { type: "error", requestId, code, message, retryable };
}


function boundedArticleContext(content: string): string {
    const maximumCharacters = 24_000;
    if (content.length <= maximumCharacters)
        return content;

    const half = Math.floor(maximumCharacters / 2);
    return `${content.slice(0, half)}\n\n[Middle of article omitted to bound editorial context.]\n\n${content.slice(-half)}`;
}


export async function handleEditorialRoute(request: IncomingMessage, response: ServerResponse, pathname: string, config: ServerConfig, repositories: Repositories, provider: EditorialProvider | undefined): Promise<boolean> {
    const match = /^\/api\/documents\/([^/]+)\/editorial$/.exec(pathname);
    if (request.method !== HTTP_METHOD.POST || !match)
        return false;

    const documentId = decodeURIComponent(match[1]);
    const body = object(await readJson(request));
    const requestId = string(body.requestId, "requestId");
    const prompt = string(body.prompt, "prompt");
    const document = repositories.getDocument(documentId);

    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });

    if (!document) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Article not found. Select an existing article and try again.", false));
        response.end();

        return true;
    }

    if (!prompt.trim()) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Editorial request must not be empty.", false));
        response.end();

        return true;
    }

    if (!provider) {
        writeEditorialEvent(response, errorEvent(requestId, "configuration", "Add OPENAI_API_KEY to the local service environment, then retry.", false));
        response.end();

        return true;
    }

    const signal = requestAbortedSignal(request, response);
    const session = repositories.getEditorialSession(documentId);
    let completed = false;

    try {
        for await (const event of provider.stream({ model: config.openAiModel, prompt, article: boundedArticleContext(document.currentVersion.content), previousResponseId: session?.previousResponseId }, signal)) {
            if (event.type === PROVIDER_STREAM_EVENT.COMPLETED) {
                completed = true;
                repositories.saveEditorialSession(documentId, event.responseId);
            }

            writeEditorialEvent(response, { ...event, requestId });
        }

        if (!completed && !signal.aborted)
            writeEditorialEvent(response, errorEvent(requestId, "malformed_stream", "OpenAI ended before completing the proposal. Retry the request.", true));
    } catch (error) {
        if (!signal.aborted) {
            const message = error instanceof Error ? error.message : "The editorial request failed. Retry it in a moment.";
            const code = /unreadable|invalid stream|ended before completing|without a response ID/i.test(message) ? "malformed_stream" : "network";
            
            writeEditorialEvent(response, errorEvent(requestId, code, message, true));
        }
    }
    
    response.end();
    return true;
}
