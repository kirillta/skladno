import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, EDITORIAL_ERROR_CATEGORY, EDITORIAL_OPERATION, HTTP_METHOD, HTTP_STATUS, type ApplicationErrorCode, type EditorialEvent, type EditorialOperation } from "@skladno/shared";

import type { ServerConfig } from "../../config.js";
import { EDITORIAL_ENGINE_ERROR, EDITORIAL_ENGINE_EVENT, EditorialEngineError, type EditorialEngine } from "../../editorial/editorial-engine.js";
import { isEditorialOperation } from "../../editorial/workflow-prompt.js";
import { Repositories } from "../../persistence/index.js";
import { object, readJson, string } from "../json.js";


function errorEvent(requestId: string, code: Extract<EditorialEvent, { type: "error" }>["code"], errorCode: ApplicationErrorCode, retryable: boolean, parameters?: Record<string, string | number>): EditorialEvent {
    return { type: "error", requestId, code, errorCode, retryable, ...(parameters ? { parameters } : {}) };
}


function writeEditorialEvent(response: ServerResponse, event: EditorialEvent): void {
    response.write(`event: editorial\ndata: ${JSON.stringify(event)}\n\n`);
}


export async function handleEditorialRoute(request: IncomingMessage, response: ServerResponse, pathname: string, config: ServerConfig, repositories: Repositories, resolveEngine: (operation: EditorialOperation) => EditorialEngine | undefined): Promise<boolean> {
    const match = /^\/api\/articles\/([^/]+)\/editorial$/.exec(pathname);
    if (request.method !== HTTP_METHOD.POST || !match)
        return false;

    const articleId = decodeURIComponent(match[1]);
    const article = repositories.getArticle(articleId);
    const body = object(await readJson(request));
    const requestId = string(body.requestId, "requestId");
    const operation = string(body.operation, "operation");
    const authorContext = body.authorContext === undefined ? "" : string(body.authorContext, "authorContext");
    const targetLanguage = body.targetLanguage === undefined ? undefined : string(body.targetLanguage, "targetLanguage");

    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });

    if (!article) {
        writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.PROVIDER, APPLICATION_ERROR.ARTICLE_NOT_FOUND, false));
        response.end();

        return true;
    }

    if (!isEditorialOperation(operation)) {
        writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.PROVIDER, APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED, false));
        response.end();

        return true;
    }

    if (operation === EDITORIAL_OPERATION.TRANSLATION && !targetLanguage?.trim()) {
        writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.INVALID_OUTPUT, APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, false));
        response.end();

        return true;
    }

    const engine = resolveEngine(operation as EditorialOperation);
    if (!engine) {
        writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.CONFIGURATION, APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, false));
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
    const session = !isFactCheck && !isTranslation && config.aiSessionContinuationEnabled ? repositories.getEditorialSession(articleId) : undefined;
    if (!config.aiSessionContinuationEnabled)
        repositories.removeEditorialSession(articleId);

    const styleProfile = operation === EDITORIAL_OPERATION.STYLE_REVIEW ? repositories.getStyleCorpus().profile : undefined;
    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW && !styleProfile) {
        writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.PROVIDER, APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, false));
        response.end();

        return true;
    }

    let completed = false;

    try {
        for await (const event of engine.stream({
            operation,
            article: article.currentRevision.content,
            authorContext,
            ...(styleProfile ? { styleProfile } : {}),
            ...(targetLanguage ? { targetLanguage } : {}),
            ...(session?.previousResponseId ? { previousResponseId: session.previousResponseId } : {}),
        }, signal)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
                completed = true;
                if (!isFactCheck && !isTranslation && config.aiSessionContinuationEnabled)
                    repositories.saveEditorialSession(articleId, event.responseId);

                const artifactInput = {
                    articleId,
                    revisionId: article.currentRevisionId,
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
                if (isFactCheck)
                    repositories.createEditorialArtifactWithCitations(artifactInput, citations);
                else
                    repositories.createEditorialArtifact(artifactInput);

                writeEditorialEvent(response, { ...event, requestId });

                continue;
            }

            if (operation !== EDITORIAL_OPERATION.STYLE_REVIEW || event.type !== EDITORIAL_ENGINE_EVENT.TEXT_DELTA)
                writeEditorialEvent(response, { ...event, requestId });
        }

        if (!completed && !signal.aborted)
            writeEditorialEvent(response, errorEvent(requestId, EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM, APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE, true));
    } catch (error) {
        if (!signal.aborted) {
            if (error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
                repositories.removeEditorialSession(articleId);

            const code = error instanceof EditorialEngineError
                ? ({
                    [EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT]: EDITORIAL_ERROR_CATEGORY.INVALID_OUTPUT,
                    [EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM]: EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM,
                    [EDITORIAL_ENGINE_ERROR.NETWORK]: EDITORIAL_ERROR_CATEGORY.NETWORK,
                    [EDITORIAL_ENGINE_ERROR.PROVIDER]: EDITORIAL_ERROR_CATEGORY.PROVIDER,
                    [EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED]: EDITORIAL_ERROR_CATEGORY.SESSION_EXPIRED,
                } as const)[error.code]
                : EDITORIAL_ERROR_CATEGORY.NETWORK;

            const errorCode = error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
                ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
                : error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT
                    ? APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED
                    : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
            writeEditorialEvent(response, errorEvent(requestId, code, errorCode, true));
        }
    }

    response.end();
    return true;
}
