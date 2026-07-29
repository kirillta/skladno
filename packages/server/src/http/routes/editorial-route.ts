import type { IncomingMessage, ServerResponse } from "node:http";
import { EDITORIAL_OPERATION, HTTP_METHOD, HTTP_STATUS, type EditorialEvent } from "@skladno/shared";

import type { ServerConfig } from "../../config.js";
import { EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngine } from "../../editorial/editorial-engine.js";
import { isEditorialOperation } from "../../editorial/workflow-prompt.js";
import { Repositories } from "../../persistence/index.js";
import { object, readJson, string } from "../json.js";


function errorEvent(requestId: string, code: Extract<EditorialEvent, { type: "error" }>["code"], message: string, retryable: boolean): EditorialEvent {
    return { type: "error", requestId, code, message, retryable };
}


function writeEditorialEvent(response: ServerResponse, event: EditorialEvent): void {
    response.write(`event: editorial\ndata: ${JSON.stringify(event)}\n\n`);
}


export async function handleEditorialRoute(request: IncomingMessage, response: ServerResponse, pathname: string, config: ServerConfig, repositories: Repositories, engine: EditorialEngine | undefined): Promise<boolean> {
    const match = /^\/api\/documents\/([^/]+)\/editorial$/.exec(pathname);
    if (request.method !== HTTP_METHOD.POST || !match)
        return false;

    const documentId = decodeURIComponent(match[1]);
    const document = repositories.getDocument(documentId);
    const body = object(await readJson(request));
    const requestId = string(body.requestId, "requestId");
    const operation = string(body.operation, "operation");
    const authorContext = body.authorContext === undefined ? "" : string(body.authorContext, "authorContext");
    const targetLanguage = body.targetLanguage === undefined ? undefined : string(body.targetLanguage, "targetLanguage");

    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });

    if (!document) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Article not found. Select an existing article and try again.", false));
        response.end();

        return true;
    }

    if (!isEditorialOperation(operation)) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Choose an available editorial workflow.", false));
        response.end();

        return true;
    }

    if (operation === EDITORIAL_OPERATION.TRANSLATION && !targetLanguage?.trim()) {
        writeEditorialEvent(response, errorEvent(requestId, "invalid_output", "Choose a target language before requesting a translation.", false));
        response.end();

        return true;
    }

    if (!engine) {
        writeEditorialEvent(response, errorEvent(requestId, "configuration", "Add OPENAI_API_KEY to the local service environment, then retry.", false));
        response.end();

        return true;
    }

    const controller = new AbortController();
    request.once("aborted", () => controller.abort());
    request.once("close", () => {
        if (!request.complete)
            controller.abort();
    });
    
    response.once("close", () => controller.abort());

    const signal = controller.signal;
    const isFactCheck = operation === EDITORIAL_OPERATION.FACT_CHECK;
    const isTranslation = operation === EDITORIAL_OPERATION.TRANSLATION;
    const session = !isFactCheck && !isTranslation && config.openAiStoreResponses ? repositories.getEditorialSession(documentId) : undefined;
    if (!config.openAiStoreResponses)
        repositories.removeEditorialSession(documentId);

    const styleProfile = operation === EDITORIAL_OPERATION.STYLE_REVIEW ? repositories.getStyleCorpus().profile : undefined;
    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW && !styleProfile) {
        writeEditorialEvent(response, errorEvent(requestId, "provider", "Add at least one style corpus item before checking style.", false));
        response.end();

        return true;
    }

    let completed = false;

    try {
        for await (const event of engine.stream({
            operation,
            article: document.currentVersion.content,
            authorContext,
            ...(styleProfile ? { styleProfile } : {}),
            ...(targetLanguage ? { targetLanguage } : {}),
            ...(session?.previousResponseId ? { previousResponseId: session.previousResponseId } : {}),
        }, signal)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
                completed = true;
                if (!isFactCheck && !isTranslation && config.openAiStoreResponses)
                    repositories.saveEditorialSession(documentId, event.responseId);

                const artifactInput = {
                    documentId,
                    versionId: document.currentVersionId,
                    kind: isFactCheck ? "fact-check" : operation === EDITORIAL_OPERATION.STYLE_REVIEW ? "style-review" : "editorial-proposal",
                    content: JSON.stringify({
                        requestId,
                        operation,
                        authorContext,
                        ...(targetLanguage ? { targetLanguage } : {}),
                        responseId: event.responseId,
                        proposal: event.text,
                        styleProfile,
                        findings: event.styleReview?.findings,
                        factCheck: event.factCheck,
                        translation: event.translation,
                    }),
                };
                const citations = event.factCheck?.findings.flatMap((finding) => finding.sources.map((source) => ({
                                url: source.url,
                                title: source.title,
                                excerpt: source.excerpt,
                                uncertainty: `${source.quality}${source.publishedAt ? `; published ${source.publishedAt}` : ""}; ${finding.uncertainty}`,
                            }))) ?? [];
                isFactCheck
                    ? repositories.createWorkflowArtifactWithCitations(artifactInput, citations)
                    : repositories.createWorkflowArtifact(artifactInput);
                writeEditorialEvent(response, { ...event, requestId });

                continue;
            }

            if (operation !== EDITORIAL_OPERATION.STYLE_REVIEW || event.type !== EDITORIAL_ENGINE_EVENT.TEXT_DELTA)
                writeEditorialEvent(response, { ...event, requestId });
        }

        if (!completed && !signal.aborted)
            writeEditorialEvent(response, errorEvent(requestId, "malformed_stream", "OpenAI ended before completing the proposal. Retry the request.", true));
    } catch (error) {
        if (!signal.aborted) {
            if (error instanceof EditorialEngineError && error.code === "session_expired")
                repositories.removeEditorialSession(documentId);

            const message = error instanceof Error ? error.message : "The editorial request failed. Retry it in a moment.";
            const code = error instanceof EditorialEngineError
                ? ({
                    invalid_output: "invalid_output",
                    incomplete_stream: "malformed_stream",
                    network: "network",
                    provider: "provider",
                    session_expired: "session_expired",
                } as const)[error.code]
                : "network";
            
            writeEditorialEvent(response, errorEvent(requestId, code, message, true));
        }
    }
    
    response.end();
    return true;
}
