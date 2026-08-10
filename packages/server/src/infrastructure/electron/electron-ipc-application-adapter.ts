import { APPLICATION_ERROR, EDITORIAL_ERROR_CATEGORY, EDITORIAL_OPERATION, ELECTRON_APPLICATION_METHOD, ELECTRON_IPC_CHANNEL, HTTP_STATUS, isElectronApplicationMethod, type ApplicationErrorCode, type ElectronApplicationMethod, type ElectronIpcError, type ElectronInvokeRequest, type ElectronInvokeResult, type ElectronStreamEvent, type ElectronStreamRequest, type AssistantEvent, type EditorialEvent } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import { ArticleDraftConflictError } from "../../application/errors/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../../application/errors/article-revision-conflict-error.js";
import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import type { EditorialService } from "../../application/editorial/editorial-service.js";
import type { EditorialServiceRequest } from "../../application/editorial/editorial-request.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EDITORIAL_ENGINE_EVENT } from "../../application/ports/editorial-engine-events.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { isEditorialOperation } from "../../application/editorial/workflow-prompt.js";


export interface ElectronIpcMainEvent {
    sender: {
        send(channel: string, payload: ElectronStreamEvent): void;
    };
}


export interface ElectronIpcMain {
    handle(channel: string, listener: (event: ElectronIpcMainEvent, request: unknown) => Promise<ElectronInvokeResult> | ElectronInvokeResult): void;
    on(channel: string, listener: (event: ElectronIpcMainEvent, payload: unknown) => void): void;
}


function errorPayload(error: unknown): ElectronIpcError {
    if (error instanceof ArticleRevisionConflictError)
        return { code: APPLICATION_ERROR.REVISION_CONFLICT, status: HTTP_STATUS.CONFLICT, article: error.article };

    if (error instanceof ArticleDraftConflictError)
        return { code: APPLICATION_ERROR.DRAFT_CONFLICT, status: HTTP_STATUS.CONFLICT, article: error.article, ...(error.draft ? { draft: error.draft } : {}) };

    if (error instanceof ApplicationServiceError)
        return { code: error.code, status: error.status, ...(error.parameters ? { parameters: error.parameters } : {}) };

    return { code: APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED, status: HTTP_STATUS.INTERNAL_SERVER_ERROR };
}


function validInvokeRequest(value: unknown): value is ElectronInvokeRequest {
    if (!value || typeof value !== "object")
        return false;

    const candidate = value as { method?: unknown; args?: unknown };
    return isElectronApplicationMethod(candidate.method) && Array.isArray(candidate.args);
}


async function invokeApplicationMethod(method: ElectronApplicationMethod, args: readonly unknown[], services: ApplicationServices, now: () => string): Promise<unknown> {
    switch (method) {
        case ELECTRON_APPLICATION_METHOD.getHealth:
            return { status: HTTP_STATUS.OK, service: "skladno-local-service", timestamp: now() };
        case ELECTRON_APPLICATION_METHOD.getApplicationSettings:
            return services.settings.getSnapshot();
        case ELECTRON_APPLICATION_METHOD.updateGeneralSettings:
            return services.settings.updateGeneral(args[0]);
        case ELECTRON_APPLICATION_METHOD.updateBackupPolicy:
            return services.settings.updateBackupPolicy(args[0]);
        case ELECTRON_APPLICATION_METHOD.updateKeyBindingOverrides:
            return services.settings.updateKeyBindingOverrides(args[0]);
        case ELECTRON_APPLICATION_METHOD.addOpenAiConnection:
            return services.settings.createAiConnection(args[0] as { label?: unknown; environmentVariableName?: unknown });
        case ELECTRON_APPLICATION_METHOD.updateOpenAiConnection:
            return services.settings.updateAiConnection(String(args[0]), args[1] as { label?: unknown; environmentVariableName?: unknown });
        case ELECTRON_APPLICATION_METHOD.removeOpenAiConnection:
            return services.settings.deleteAiConnection(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.setActiveOpenAiConnection:
            return services.settings.activateAiConnection(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.testOpenAiConnection:
            return services.settings.testAiConnection(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.refreshOpenAiModels:
            return services.settings.listAiModels();
        case ELECTRON_APPLICATION_METHOD.updateModelPreferences:
            return services.settings.updateModelPreferences(args[0]);
        case ELECTRON_APPLICATION_METHOD.listArticles:
            return services.articles.listArticles();
        case ELECTRON_APPLICATION_METHOD.createArticle:
            return services.articles.createArticle(args[0] as import("@skladno/shared").CreateArticleInput);
        case ELECTRON_APPLICATION_METHOD.updateArticle:
            return services.articles.updateArticle(String(args[0]), args[1] as import("@skladno/shared").UpdateArticleInput);
        case ELECTRON_APPLICATION_METHOD.deleteArticle:
            return services.articles.deleteArticle(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.saveArticleDraft:
            return services.articles.saveDraft(String(args[0]), args[1] as import("@skladno/shared").SaveArticleDraftInput);
        case ELECTRON_APPLICATION_METHOD.discardArticleDraft:
            return services.articles.discardDraft(String(args[0]), Number(args[1]));
        case ELECTRON_APPLICATION_METHOD.saveArticleRevision:
            return services.articles.saveRevision(String(args[0]), args[1] as import("@skladno/shared").SaveArticleRevisionInput);
        case ELECTRON_APPLICATION_METHOD.listArticleRevisions:
            return services.articles.listRevisions(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.acceptProposal:
            return services.articles.acceptProposal(String(args[0]), args[1] as import("@skladno/shared").AcceptProposalInput);
        case ELECTRON_APPLICATION_METHOD.restoreRevision:
            return services.articles.restoreRevision(String(args[0]), String(args[1]));
        case ELECTRON_APPLICATION_METHOD.listAssistantMessages:
            return services.assistant.listMessages(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.getStyleCorpus:
            return services.styleCorpus.get();
        case ELECTRON_APPLICATION_METHOD.addStyleCorpusItem:
            return services.styleCorpus.add(args[0] as import("@skladno/shared").CreateStyleCorpusItemInput);
        case ELECTRON_APPLICATION_METHOD.removeStyleCorpusItem:
            return services.styleCorpus.remove(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.getPublishLimitProfile:
            return services.publishing.getProfile();
        case ELECTRON_APPLICATION_METHOD.setPublishLimitProfile:
            return services.publishing.setProfile(args[0] as import("@skladno/shared").PublishLimitProfileId);
    }
}


async function invoke(request: unknown, services: ApplicationServices, now: () => string): Promise<ElectronInvokeResult> {
    if (!validInvokeRequest(request))
        return { ok: false, error: { code: APPLICATION_ERROR.INVALID_REQUEST, status: HTTP_STATUS.BAD_REQUEST } };

    try {
        const value = await invokeApplicationMethod(request.method, request.args, services, now);
        return { ok: true, value } as ElectronInvokeResult;
    } catch (error) {
        return { ok: false, error: errorPayload(error) };
    }
}


function validStreamRequest(value: unknown): value is ElectronStreamRequest {
    if (!value || typeof value !== "object")
        return false;

    const candidate = value as { streamId?: unknown; kind?: unknown; articleId?: unknown; input?: unknown };
    return typeof candidate.streamId === "string"
        && candidate.streamId.length > 0
        && (candidate.kind === "assistant" || candidate.kind === "editorial")
        && typeof candidate.articleId === "string"
        && Boolean(candidate.input)
        && typeof candidate.input === "object";
}


function send(event: ElectronIpcMainEvent, streamId: string, value: AssistantEvent | EditorialEvent): void {
    event.sender.send(ELECTRON_IPC_CHANNEL.streamEvent, { streamId, event: value });
}


function assistantErrorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


function editorialFailure(error: unknown): { category: Extract<EditorialEvent, { type: "error" }>["code"]; errorCode: ApplicationErrorCode } {
    const category = error instanceof EditorialEngineError
        ? error.code === EDITORIAL_ENGINE_ERROR.NETWORK
            ? EDITORIAL_ERROR_CATEGORY.NETWORK
            : error.code === EDITORIAL_ENGINE_ERROR.SESSION_EXPIRED
                ? EDITORIAL_ERROR_CATEGORY.SESSION_EXPIRED
                : EDITORIAL_ERROR_CATEGORY.PROVIDER
        : error instanceof Error && /network|fetch|connect|timeout|ECONN|ENOTFOUND/i.test(error.message)
            ? EDITORIAL_ERROR_CATEGORY.NETWORK
            : EDITORIAL_ERROR_CATEGORY.PROVIDER;

    return {
        category: category ?? EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM,
        errorCode: error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
            ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
            : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED,
    };
}


async function streamAssistant(event: ElectronIpcMainEvent, request: ElectronStreamRequest, services: ApplicationServices, controller: AbortController): Promise<void> {
    const input = request.input as import("@skladno/shared").StartAssistantRequest;
    try {
        const prepared = services.assistant.prepare({ ...input, articleId: request.articleId });
        for await (const item of services.assistant.stream(prepared, controller.signal))
            send(event, request.streamId, item);
    } catch (error) {
        if (!controller.signal.aborted)
            send(event, request.streamId, { type: "error", requestId: input.requestId, errorCode: assistantErrorCode(error), retryable: true });
    }
}


async function streamEditorial(event: ElectronIpcMainEvent, request: ElectronStreamRequest, editorial: EditorialService, controller: AbortController): Promise<void> {
    const input = request.input as import("@skladno/shared").StartEditorialRequest;
    const requestId = input.requestId;
    if (!isEditorialOperation(input.operation)) {
        send(event, request.streamId, { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.CONFIGURATION, errorCode: APPLICATION_ERROR.EDITORIAL_OPERATION_UNSUPPORTED, retryable: false });
        return;
    }

    if (input.operation === EDITORIAL_OPERATION.TRANSLATION && !input.targetLanguage?.trim()) {
        send(event, request.streamId, { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.CONFIGURATION, errorCode: APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, retryable: false });
        return;
    }

    const serviceRequest: EditorialServiceRequest = { ...input, articleId: request.articleId, operation: input.operation, authorContext: input.authorContext ?? "" };
    let completed = false;
    try {
        for await (const item of editorial.stream(serviceRequest, controller.signal)) {
            if (item.type === EDITORIAL_ENGINE_EVENT.COMPLETED) {
                completed = true;
                send(event, request.streamId, { ...item, requestId });
            } else if (serviceRequest.operation !== EDITORIAL_OPERATION.STYLE_REVIEW || item.type !== EDITORIAL_ENGINE_EVENT.TEXT_DELTA) {
                send(event, request.streamId, { ...item, requestId });
            }
        }

        if (!completed && !controller.signal.aborted)
            send(event, request.streamId, { type: "error", requestId, code: EDITORIAL_ERROR_CATEGORY.MALFORMED_STREAM, errorCode: APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE, retryable: true });
    } catch (error) {
        if (!controller.signal.aborted) {
            const failure = editorialFailure(error);
            send(event, request.streamId, { type: "error", requestId, code: failure.category, errorCode: failure.errorCode, retryable: true });
        }
    }
}


export function registerElectronIpcApplicationAdapter(ipcMain: ElectronIpcMain, services: ApplicationServices, editorial: EditorialService, now = () => new Date().toISOString()): void {
    const controllers = new Map<string, AbortController>();

    ipcMain.handle(ELECTRON_IPC_CHANNEL.invoke, (_event, request) => invoke(request, services, now));
    ipcMain.on(ELECTRON_IPC_CHANNEL.cancel, (_event, payload) => {
        if (!payload || typeof payload !== "object" || typeof (payload as { streamId?: unknown }).streamId !== "string")
            return;

        controllers.get((payload as { streamId: string }).streamId)?.abort();
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
