import type { IncomingMessage, ServerResponse } from "node:http";
import { EDITORIAL_OPERATION, HTTP_METHOD, HTTP_STATUS, type EditorialEvent, type StyleFinding, type StyleReview } from "@skladno/shared";

import type { ServerConfig } from "../../config.js";
import { PROVIDER_STREAM_EVENT, requestAbortedSignal, writeEditorialEvent, type EditorialProvider } from "../../editorial/openai-responses-provider.js";
import { createEditorialPrompt, isEditorialOperation } from "../../editorial/workflow-prompt.js";
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


function parseStyleReview(value: string): { proposal: string; styleReview: StyleReview } {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new Error("Style review was not valid structured output. Retry the request.");

    const record = parsed as Record<string, unknown>;
    if (typeof record.proposal !== "string" || !Array.isArray(record.findings))
        throw new Error("Style review was missing its proposal or findings. Retry the request.");

    const findings = record.findings.map((finding): StyleFinding => {
        if (typeof finding !== "object" || finding === null || Array.isArray(finding))
            throw new Error("Style review included an invalid finding. Retry the request.");

        const item = finding as Record<string, unknown>;
        if (typeof item.divergence !== "string" || typeof item.suggestion !== "string" || !Array.isArray(item.traitIds) || !item.traitIds.every((traitId) => typeof traitId === "string"))
            throw new Error("Style review included an invalid finding. Retry the request.");

        return { 
            divergence: item.divergence, 
            suggestion: item.suggestion, 
            traitIds: item.traitIds as string[] 
        };
    });

    return { proposal: record.proposal, styleReview: { findings } };
}


export async function handleEditorialRoute(request: IncomingMessage, response: ServerResponse, pathname: string, config: ServerConfig, repositories: Repositories, provider: EditorialProvider | undefined): Promise<boolean> {
    const match = /^\/api\/documents\/([^/]+)\/editorial$/.exec(pathname);
    if (request.method !== HTTP_METHOD.POST || !match)
        return false;

    const documentId = decodeURIComponent(match[1]);
    const document = repositories.getDocument(documentId);
    const body = object(await readJson(request));
    const requestId = string(body.requestId, "requestId");
    const operation = string(body.operation, "operation");
    const authorContext = body.authorContext === undefined ? "" : string(body.authorContext, "authorContext");

    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });

    if (!document) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Article not found. Select an existing article and try again.", false));
        response.end();

        return true;
    }

    if (!isEditorialOperation(operation)) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Choose either thesis to narrative or flow revision.", false));
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
    const styleProfile = operation === EDITORIAL_OPERATION.STYLE_REVIEW ? repositories.getStyleCorpus().profile : undefined;
    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW && !styleProfile) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Add at least one style corpus item before checking style.", false));
        response.end();

        return true;
    }

    const prompt = createEditorialPrompt(operation, authorContext, styleProfile);
    let completed = false;

    try {
        for await (const event of provider.stream({ model: config.openAiModel, prompt, article: boundedArticleContext(document.currentVersion.content), previousResponseId: session?.previousResponseId }, signal)) {
            if (event.type === PROVIDER_STREAM_EVENT.COMPLETED) {
                const styleResult = operation === EDITORIAL_OPERATION.STYLE_REVIEW ? parseStyleReview(event.text) : undefined;
                completed = true;
                repositories.saveEditorialSession(documentId, event.responseId);
                repositories.createWorkflowArtifact({
                    documentId,
                    versionId: document.currentVersionId,
                    kind: operation === EDITORIAL_OPERATION.STYLE_REVIEW ? "style-review" : "editorial-proposal",
                    content: JSON.stringify({
                        requestId,
                        operation,
                        authorContext,
                        responseId: event.responseId,
                        proposal: styleResult?.proposal ?? event.text,
                        styleProfile,
                        findings: styleResult?.styleReview.findings,
                    }),
                });
                if (styleResult)
                    writeEditorialEvent(response, {
                        type: "completed",
                        requestId,
                        responseId: event.responseId,
                        text: styleResult.proposal,
                        styleReview: styleResult.styleReview,
                    });
                else
                    writeEditorialEvent(response, { ...event, requestId });

                continue;
            }

            if (operation !== EDITORIAL_OPERATION.STYLE_REVIEW || event.type !== PROVIDER_STREAM_EVENT.TEXT_DELTA)
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
