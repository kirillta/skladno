import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS, resolveBuiltInSkillId, type AssistantEvent, type AssistantRequestScope, type StartAssistantRequest } from "@skladno/shared";

import { AssistantService, type PreparedAssistantRequest } from "../../application/assistant/assistant-service.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { object, readJson, string, writeJson } from "../transport/json.js";


function writeEvent(response: ServerResponse, event: AssistantEvent): void {
    response.write(`event: assistant\ndata: ${JSON.stringify(event)}\n\n`);
}


function scope(value: unknown): AssistantRequestScope {
    const candidate = object(value);
    const baseRevisionId = string(candidate.baseRevisionId, "scope.baseRevisionId");
    if (candidate.kind === "article")
        return { kind: "article", baseRevisionId };

    if (candidate.kind !== "selection"
        || !Number.isInteger(candidate.startOffset)
        || !Number.isInteger(candidate.endOffset)
        || Number(candidate.startOffset) < 0
        || Number(candidate.endOffset) <= Number(candidate.startOffset)
    )
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);

    return { kind: "selection", baseRevisionId, startOffset: Number(candidate.startOffset), endOffset: Number(candidate.endOffset) };
}


function readAssistantRequest(body: Record<string, unknown>): StartAssistantRequest {
    const requestId = string(body.requestId, "requestId");
    if (body.kind === "retry")
        return { kind: "retry", requestId, retryOfRequestId: string(body.retryOfRequestId, "retryOfRequestId") };

    if (body.kind !== "new" && body.kind !== undefined)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    const explicitSkillValue = body.explicitSkillId === undefined ? undefined : string(body.explicitSkillId, "explicitSkillId");
    const explicitSkillId = explicitSkillValue && resolveBuiltInSkillId(explicitSkillValue);
    if (explicitSkillValue && !explicitSkillId)
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);

    const targetLanguage = body.targetLanguage === undefined ? undefined : string(body.targetLanguage, "targetLanguage");
    const skillOffset = body.skillOffset === undefined ? undefined : Number(body.skillOffset);
    if (skillOffset !== undefined && (!explicitSkillValue || !Number.isInteger(skillOffset) || skillOffset < 0 || skillOffset > String(body.authorMessage ?? "").length))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);

    return {
        kind: "new",
        requestId,
        authorMessage: string(body.authorMessage, "authorMessage"),
        scope: scope(body.scope),
        ...(explicitSkillId ? { explicitSkillId } : {}),
        ...(skillOffset === undefined ? {} : { skillOffset }),
        ...(targetLanguage ? { targetLanguage } : {}),
    };
}


function startResponseStream(response: ServerResponse): AbortController {
    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });
    const controller = new AbortController();

    return controller;
}


function streamErrorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


async function streamAssistantRequest(request: PreparedAssistantRequest, incomingRequest: IncomingMessage, response: ServerResponse, assistant: AssistantService): Promise<void> {
    const controller = startResponseStream(response);
    incomingRequest.once("aborted", () => controller.abort());
    response.once("close", () => controller.abort());
    try {
        for await (const event of assistant.stream(request, controller.signal))
            writeEvent(response, event);
    } catch (error) {
        if (!controller.signal.aborted)
            writeEvent(response, { type: "error", requestId: request.requestId, errorCode: streamErrorCode(error), retryable: true });
    }

    response.end();
}


export function listAssistantMessagesRoute(response: ServerResponse, articleId: string, assistant: AssistantService): void {
    writeJson(response, HTTP_STATUS.OK, assistant.listMessages(articleId));
}


export async function createAssistantRequestRoute(request: IncomingMessage, response: ServerResponse, articleId: string, assistant: AssistantService): Promise<void> {
    const input = readAssistantRequest(object(await readJson(request)));
    const prepared = assistant.prepare({ ...input, articleId });
    await streamAssistantRequest(prepared, request, response, assistant);
}
