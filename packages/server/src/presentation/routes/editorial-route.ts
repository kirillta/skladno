import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, EDITORIAL_ERROR_CATEGORY, EDITORIAL_OPERATION, HTTP_STATUS, type ApplicationErrorCode, type EditorialEvent, type EditorialOperation } from "@skladno/shared";

import { EditorialService } from "../../application/editorial/editorial-service.js";
import type { EditorialServiceRequest } from "../../application/editorial/editorial-request.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { isEditorialOperation } from "../../application/editorial/workflow-prompt.js";
import { object, readJson, string } from "../transport/json.js";


function errorEvent(requestId: string, code: Extract<EditorialEvent, { type: "error" }>["code"], errorCode: ApplicationErrorCode, retryable: boolean): EditorialEvent {
    return { type: "error", requestId, code, errorCode, retryable };
}


function writeEditorialEvent(response: ServerResponse, event: EditorialEvent): void {
    response.write(`event: editorial\ndata: ${JSON.stringify(event)}\n\n`);
}


async function readEditorialRequest(request: IncomingMessage, articleId: string): Promise<EditorialServiceRequest> {
    const body = object(await readJson(request));
    const operation = string(body.operation, "operation");

    return {
        articleId,
        requestId: string(body.requestId, "requestId"),
        operation: operation as EditorialOperation,
        authorContext: body.authorContext === undefined ? "" : string(body.authorContext, "authorContext"),
        ...(body.targetLanguage === undefined ? {} : { targetLanguage: string(body.targetLanguage, "targetLanguage") }),
    };
}


function openEditorialStream(request: IncomingMessage, response: ServerResponse): AbortController {
    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });
    const controller = new AbortController();
    request.once("aborted", () => controller.abort());
    response.once("close", () => controller.abort());

    return controller;
}


function rejectUnsupportedOperation(response: ServerResponse, request: EditorialServiceRequest): boolean {
    if (isEditorialOperation(request.operation))
        return false;

    writeEditorialEvent(response, errorEvent(request.requestId, EDITORIAL_ERROR_CATEGORY.PROVIDER, APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED, false));
    response.end();

    return true;
}


function rejectMissingTargetLanguage(response: ServerResponse, request: EditorialServiceRequest): boolean {
    if (request.operation !== EDITORIAL_OPERATION.TRANSLATION || request.targetLanguage?.trim())
        return false;

    writeEditorialEvent(response, errorEvent(request.requestId, EDITORIAL_ERROR_CATEGORY.INVALID_OUTPUT, APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, false));
    response.end();

    return true;
}


function editorialError(error: unknown): { category: Extract<EditorialEvent, { type: "error" }>["code"]; errorCode: ApplicationErrorCode } {
    const category = error instanceof EditorialEngineError
        ? ({
            [EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT]: EDITORIAL_ERROR_CATEGORY.INVALID_OUTPUT,
            [EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM]: EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM,
            [EDITORIAL_ENGINE_ERROR.NETWORK]: EDITORIAL_ERROR_CATEGORY.NETWORK,
            [EDITORIAL_ENGINE_ERROR.PROVIDER]: EDITORIAL_ERROR_CATEGORY.PROVIDER,
            [EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED]: EDITORIAL_ERROR_CATEGORY.SESSION_EXPIRED,
        } as const)[error.code]
        : error instanceof Error && /network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(error.message)
            ? EDITORIAL_ERROR_CATEGORY.NETWORK
            : EDITORIAL_ERROR_CATEGORY.PROVIDER;

    return {
        category,
        errorCode: error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED,
    };
}


async function streamEditorialEvents(response: ServerResponse, editorial: EditorialService, request: EditorialServiceRequest, controller: AbortController): Promise<void> {
    let completed = false;
    try {
        for await (const event of editorial.stream(request, controller.signal)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
                completed = true;
                writeEditorialEvent(response, { ...event, requestId: request.requestId });

                continue;
            }

            if (request.operation !== EDITORIAL_OPERATION.STYLE_REVIEW || event.type !== EDITORIAL_ENGINE_EVENT.TEXT_DELTA)
                writeEditorialEvent(response, { ...event, requestId: request.requestId });
        }

        if (!completed && !controller.signal.aborted)
            writeEditorialEvent(response, errorEvent(request.requestId, EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM, APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE, true));
    } catch (error) {
        if (!controller.signal.aborted) {
            const failure = editorialError(error);
            writeEditorialEvent(response, errorEvent(request.requestId, failure.category, failure.errorCode, true));
        }
    }
}


export async function handleEditorialRoute(request: IncomingMessage, response: ServerResponse, articleId: string, editorial: EditorialService): Promise<void> {
    const editorialRequest = await readEditorialRequest(request, articleId);

    const controller = openEditorialStream(request, response);
    if (rejectUnsupportedOperation(response, editorialRequest) || rejectMissingTargetLanguage(response, editorialRequest))
        return;

    await streamEditorialEvents(response, editorial, editorialRequest, controller);
    response.end();
}
