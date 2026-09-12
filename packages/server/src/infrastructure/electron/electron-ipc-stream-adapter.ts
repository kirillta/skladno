import { APPLICATION_ERROR, EDITORIAL_ERROR_CATEGORY, EDITORIAL_OPERATION, ELECTRON_IPC_CHANNEL, resolveBuiltInSkillId, type ApplicationErrorCode, type ElectronStreamEvent, type ElectronStreamRequest, type EditorialEvent } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import type { EditorialService } from "../../application/services/editorial/editorial-service.js";
import type { EditorialServiceRequest } from "../../application/models/editorial/editorial-request.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/errors/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/models/editorial/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/errors/editorial-engine-error.js";
import { isEditorialOperation } from "../../application/helpers/editorial/workflow-prompt.js";
import type { ElectronIpcMain, ElectronIpcMainEvent } from "./electron-ipc-types.js";


function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function validAssistantRequest(value: unknown): value is Extract<ElectronStreamRequest, { kind: "assistant" }>["input"] {
    if (!isRecord(value) || typeof value.requestId !== "string" || typeof value.authorMessage !== "string" || !isRecord(value.scope))
        return false;

    if (typeof value.scope.baseRevisionId !== "string")
        return false;

    if (value.scope.kind === "selection" && (typeof value.scope.startOffset !== "number" || typeof value.scope.endOffset !== "number"))
        return false;

    if (value.scope.kind !== "article" && value.scope.kind !== "selection")
        return false;

    return (value.explicitSkillId === undefined || Boolean(resolveBuiltInSkillId(value.explicitSkillId)))
        && (value.skillOffset === undefined || typeof value.skillOffset === "number")
        && (value.targetLanguage === undefined || typeof value.targetLanguage === "string")
        && (value.retryOfRequestId === undefined || typeof value.retryOfRequestId === "string");
}


function validEditorialRequest(value: unknown): value is Extract<ElectronStreamRequest, { kind: "editorial" }>["input"] {
    return isRecord(value)
        && typeof value.requestId === "string"
        && typeof value.operation === "string"
        && isEditorialOperation(value.operation)
        && (value.authorContext === undefined || typeof value.authorContext === "string")
        && (value.targetLanguage === undefined || typeof value.targetLanguage === "string");
}


function validStreamRequest(value: unknown): value is ElectronStreamRequest {
    if (!isRecord(value) || typeof value.streamId !== "string" || !value.streamId || typeof value.articleId !== "string")
        return false;

    if (value.kind === "assistant")
        return validAssistantRequest(value.input);

    if (value.kind === "editorial")
        return validEditorialRequest(value.input);

    return false;
}


function send(event: ElectronIpcMainEvent, value: ElectronStreamEvent): void {
    event.sender.send(ELECTRON_IPC_CHANNEL.streamEvent, value);
}


function assistantErrorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


function editorialFailure(error: unknown): { category: Extract<EditorialEvent, { type: "error" }>["code"]; errorCode: ApplicationErrorCode } {
    if (error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING)
        return { category: EDITORIAL_ERROR_CATEGORY.CONFIGURATION, errorCode: error.code };

    let category: Extract<EditorialEvent, { type: "error" }>["code"] = EDITORIAL_ERROR_CATEGORY.PROVIDER;
    if (error instanceof EditorialEngineError) {
        if (error.code === EDITORIAL_ENGINE_ERROR.NETWORK)
            category = EDITORIAL_ERROR_CATEGORY.NETWORK;
        else if (error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED)
            category = EDITORIAL_ERROR_CATEGORY.SESSION_EXPIRED;
    } else if (error instanceof Error && /network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(error.message)) {
        category = EDITORIAL_ERROR_CATEGORY.NETWORK;
    }

    return {
        category,
        errorCode: error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED
    };
}


async function streamAssistant(event: ElectronIpcMainEvent, request: Extract<ElectronStreamRequest, { kind: "assistant" }>, services: ApplicationServices, controller: AbortController): Promise<void> {
    const input = request.input;
    try {
        const explicitSkillId = input.kind === "new" && input.explicitSkillId ? resolveBuiltInSkillId(input.explicitSkillId) : undefined;
        const prepared = services.assistant.prepare({ ...input, articleId: request.articleId, ...(explicitSkillId ? { explicitSkillId } : {}) });
        for await (const item of services.assistant.stream(prepared, controller.signal))
            send(event, { streamId: request.streamId, kind: "assistant", event: item });
    } catch (error) {
        if (!controller.signal.aborted)
            send(event, { streamId: request.streamId, kind: "assistant", event: { type: "error", requestId: input.requestId, errorCode: assistantErrorCode(error), retryable: true } });
    }
}


async function streamEditorial(event: ElectronIpcMainEvent, request: Extract<ElectronStreamRequest, { kind: "editorial" }>, editorial: EditorialService, controller: AbortController): Promise<void> {
    const input = request.input;
    const requestId = input.requestId;
    if (!isEditorialOperation(input.operation)) {
        send(event, {
            streamId: request.streamId,
            kind: "editorial",
            event: { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.CONFIGURATION, errorCode: APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED, retryable: false }
        });

        return;
    }

    if (input.operation === EDITORIAL_OPERATION.TRANSLATION && !input.targetLanguage?.trim()) {
        send(event, {
            streamId: request.streamId,
            kind: "editorial",
            event: { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.CONFIGURATION, errorCode: APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, retryable: false }
        });

        return;
    }

    const serviceRequest: EditorialServiceRequest = { ...input, articleId: request.articleId, operation: input.operation, authorContext: input.authorContext ?? "" };
    let completed = false;
    try {
        for await (const item of editorial.stream(serviceRequest, controller.signal)) {
            if (item.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
                completed = true;
                send(event, { streamId: request.streamId, kind: "editorial", event: { ...item, requestId } });
            } else if (serviceRequest.operation !== EDITORIAL_OPERATION.STYLE_REVIEW || item.type !== EDITORIAL_ENGINE_EVENT.TEXT_DELTA) {
                send(event, { streamId: request.streamId, kind: "editorial", event: { ...item, requestId } });
            }
        }

        if (!completed && !controller.signal.aborted)
            send(event, {
                streamId: request.streamId,
                kind: "editorial",
                event: { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM, errorCode: APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE, retryable: true }
            });
    } catch (error) {
        if (!controller.signal.aborted) {
            const failure = editorialFailure(error);
            send(event, { streamId: request.streamId, kind: "editorial", event: { type: "error", requestId, code: failure.category, errorCode: failure.errorCode, retryable: true } });
        }
    }
}


export function registerElectronStreamAdapters(ipcMain: ElectronIpcMain, services: ApplicationServices, editorial: EditorialService, controllers: Map<string, AbortController>): void {
    ipcMain.on(ELECTRON_IPC_CHANNEL.cancel, (_event, payload) => {
        if (isRecord(payload) && typeof payload.streamId === "string")
            controllers.get(payload.streamId)?.abort();
    });
    ipcMain.on(ELECTRON_IPC_CHANNEL.stream, (event, payload) => {
        if (!validStreamRequest(payload))
            return;

        const controller = new AbortController();
        controllers.set(payload.streamId, controller);
        void (payload.kind === "assistant" ? streamAssistant(event, payload, services, controller) : streamEditorial(event, payload, editorial, controller))
            .finally(() => controllers.delete(payload.streamId));
    });
}
