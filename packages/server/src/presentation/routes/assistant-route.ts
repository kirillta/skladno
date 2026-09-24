import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS, type AssistantCheckpointDraftMode, type AssistantEvent, type AssistantRequestScope, type StartAssistantRequest } from "@skladno/shared";

import { AssistantService, type PreparedAssistantRequest } from "../../application/assistant/assistant-service.js";
import type { AssistantSkillCatalog } from "../../application/assistant/skills/assistant-skill-catalog.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/editorial/engine/editorial-engine-error.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import type { LocalDiagnostics } from "../../infrastructure/diagnostics/local-diagnostics.js";
import { parseObject, parseString, readJson, writeJson } from "../transport/json.js";


function writeAssistantEvent(response: ServerResponse, event: AssistantEvent): void {
    response.write(`event: assistant\ndata: ${JSON.stringify(event)}\n\n`);
}


function getAssistantRequestScope(value: unknown): AssistantRequestScope {
    const candidate = parseObject(value);
    const baseRevisionId = parseString(candidate.baseRevisionId, "scope.baseRevisionId");
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


function readSkillOffset(body: Record<string, unknown>, explicitSkillValue: string | undefined): number | undefined {
    const skillOffset = body.skillOffset === undefined ? undefined : Number(body.skillOffset);
    if (skillOffset !== undefined && (!explicitSkillValue || !Number.isInteger(skillOffset) || skillOffset < 0 || skillOffset > String(body.authorMessage ?? "").length))
        throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_UNSUPPORTED, HTTP_STATUS.BAD_REQUEST);

    return skillOffset;
}


function readAssistantSkillOptions(body: Record<string, unknown>): { explicitSkillId?: string; skillOffset?: number } {
    const explicitSkillValue = body.explicitSkillId === undefined ? undefined : parseString(body.explicitSkillId, "explicitSkillId");
    const explicitSkillId = explicitSkillValue;
    const skillOffset = readSkillOffset(body, explicitSkillValue);

    return { ...(explicitSkillId ? { explicitSkillId } : {}), ...(skillOffset === undefined ? {} : { skillOffset }) };
}


function readAssistantLocaleOptions(body: Record<string, unknown>): { targetLanguage?: string; interfaceLocale?: string } {
    const targetLanguage = body.targetLanguage === undefined ? undefined : parseString(body.targetLanguage, "targetLanguage");
    const interfaceLocale = body.interfaceLocale === undefined ? undefined : parseString(body.interfaceLocale, "interfaceLocale");

    return { ...(targetLanguage ? { targetLanguage } : {}), ...(interfaceLocale ? { interfaceLocale } : {}) };
}


function readNewAssistantRequest(body: Record<string, unknown>, requestId: string): StartAssistantRequest {
    if (body.kind !== "new" && body.kind !== undefined)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    const skillOptions = readAssistantSkillOptions(body);
    const localeOptions = readAssistantLocaleOptions(body);

    return {
        kind: "new",
        requestId,
        authorMessage: parseString(body.authorMessage, "authorMessage"),
        scope: getAssistantRequestScope(body.scope),
        ...skillOptions,
        ...localeOptions,
    };
}


function readAssistantRequest(body: Record<string, unknown>): StartAssistantRequest {
    const requestId = parseString(body.requestId, "requestId");
    if (body.kind === "retry")
        return {
            kind: "retry",
            requestId,
            retryOfRequestId: parseString(body.retryOfRequestId, "retryOfRequestId"),
            ...(body.interfaceLocale === undefined ? {} : { interfaceLocale: parseString(body.interfaceLocale, "interfaceLocale") }),
        };

    return readNewAssistantRequest(body, requestId);
}


function createAssistantResponseStream(response: ServerResponse): AbortController {
    response.writeHead(HTTP_STATUS.OK, { "cache-control": "no-cache, no-transform", connection: "keep-alive", "content-type": "text/event-stream; charset=utf-8" });
    const controller = new AbortController();

    return controller;
}


function getAssistantStreamErrorCode(error: unknown) {
    if (error instanceof ApplicationServiceError)
        return error.code;

    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


async function streamAssistantRequest(request: PreparedAssistantRequest, incomingRequest: IncomingMessage, response: ServerResponse, assistant: AssistantService, diagnostics?: LocalDiagnostics): Promise<void> {
    const controller = createAssistantResponseStream(response);
    incomingRequest.once("aborted", () => controller.abort());
    response.once("close", () => controller.abort());
    try {
        for await (const event of assistant.stream(request, controller.signal))
            writeAssistantEvent(response, event);
    } catch (error) {
        const context = {
            method: incomingRequest.method ?? "POST",
            status: error instanceof ApplicationServiceError ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR
        };
        diagnostics?.write("request.failed", context, error);

        if (!controller.signal.aborted)
            writeAssistantEvent(response, { type: "error", requestId: request.requestId, errorCode: getAssistantStreamErrorCode(error), retryable: true });
    }

    response.end();
}


export function listAssistantMessagesRoute(response: ServerResponse, articleId: string, assistant: AssistantService): void {
    writeJson(response, HTTP_STATUS.OK, assistant.listMessages(articleId));
}


export function listAssistantSkillsRoute(response: ServerResponse, skills: AssistantSkillCatalog): void {
    writeJson(response, HTTP_STATUS.OK, skills.discover());
}


export function rejectAssistantTranslationRoute(response: ServerResponse, articleId: string, editorialArtifactId: string, assistant: AssistantService): void {
    assistant.rejectTranslation(articleId, editorialArtifactId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export function previewAssistantCheckpointRoute(response: ServerResponse, articleId: string, messageId: string, assistant: AssistantService): void {
    writeJson(response, HTTP_STATUS.OK, assistant.previewCheckpoint(articleId, messageId));
}


export async function restoreAssistantCheckpointRoute(request: IncomingMessage, response: ServerResponse, articleId: string, messageId: string, assistant: AssistantService): Promise<void> {
    const body = parseObject(await readJson(request));
    const draftMode = body.draftMode;
    if (draftMode !== undefined && draftMode !== "preserve" && draftMode !== "discard")
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    writeJson(response, HTTP_STATUS.OK, assistant.restoreCheckpoint(articleId, messageId, parseString(body.tailToken, "tailToken"), draftMode as AssistantCheckpointDraftMode | undefined));
}


export async function createAssistantRequestRoute(request: IncomingMessage, response: ServerResponse, articleId: string, assistant: AssistantService, diagnostics?: LocalDiagnostics): Promise<void> {
    const input = readAssistantRequest(parseObject(await readJson(request)));
    const prepared = assistant.prepare({ ...input, articleId });
    await streamAssistantRequest(prepared, request, response, assistant, diagnostics);
}
