import {
    ArticleDraftConflictError,
    ArticleRevisionConflictError,
    ApplicationClientError,
    ELECTRON_APPLICATION_METHOD,
    ELECTRON_IPC_CHANNEL,
    type ElectronApplicationMethod,
    type ElectronApplicationOperationMap,
    type ElectronCancelRequest,
    type ElectronIpcError,
    type ElectronInvokeRequest,
    type ElectronInvokeResult,
    type ElectronStreamEvent,
    type ElectronStreamRequest,
    type EditorialWorkspaceClient,
} from "@skladno/shared";


export interface ElectronIpcRenderer {
    invoke(channel: string, request: ElectronInvokeRequest): Promise<ElectronInvokeResult>;
    send(channel: string, payload: ElectronStreamRequest | ElectronCancelRequest): void;
    on(channel: string, listener: (event: unknown, payload: ElectronStreamEvent) => void): void;
    removeListener(channel: string, listener: (event: unknown, payload: ElectronStreamEvent) => void): void;
}


export interface ElectronContextBridge {
    exposeInMainWorld(name: string, api: EditorialWorkspaceClient): void;
}


function clientError(error: ElectronIpcError): Error {
    if (error.code === "revision_conflict" && error.article)
        return new ArticleRevisionConflictError(error.article);

    if (error.code === "draft_conflict" && error.article)
        return new ArticleDraftConflictError(error.article, error.draft);

    return new ApplicationClientError(error.code, error.parameters, error.status);
}


function abortError(): Error {
    return new DOMException("The Electron application request was aborted.", "AbortError");
}


function createStream<Event extends ElectronStreamEvent["event"]>(
    ipcRenderer: ElectronIpcRenderer,
    streamId: string,
    request: ElectronStreamRequest,
    onEvent: (event: Event) => void,
    signal?: AbortSignal,
): Promise<void> {
    if (signal?.aborted)
        return Promise.reject(abortError());

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const listener = (_event: unknown, payload: ElectronStreamEvent) => {
            if (payload.streamId !== streamId)
                return;

            onEvent(payload.event as Event);
            if (payload.event.type === "error") {
                const parameters = "parameters" in payload.event ? payload.event.parameters : undefined;
                settle(clientError({ code: payload.event.errorCode, status: 500, ...(parameters ? { parameters } : {}) }));

                return;
            }

            if (payload.event.type === "completed")
                settle();
        };
        const cleanup = () => {
            ipcRenderer.removeListener(ELECTRON_IPC_CHANNEL.streamEvent, listener);
            signal?.removeEventListener("abort", abort);
        };
        const settle = (error?: Error) => {
            if (settled)
                return;

            settled = true;
            cleanup();
            if (error)
                reject(error);
            else
                resolve();
        };
        const abort = () => {
            if (settled)
                return;

            settled = true;
            ipcRenderer.send(ELECTRON_IPC_CHANNEL.cancel, { streamId });
            cleanup();
            reject(abortError());
        };

        ipcRenderer.on(ELECTRON_IPC_CHANNEL.streamEvent, listener);
        signal?.addEventListener("abort", abort, { once: true });
        ipcRenderer.send(ELECTRON_IPC_CHANNEL.stream, request);
    });
}


export function createElectronApplicationClient(ipcRenderer: ElectronIpcRenderer, createStreamId = () => crypto.randomUUID()): EditorialWorkspaceClient {
    async function invoke<Method extends ElectronApplicationMethod>(method: Method, ...args: ElectronApplicationOperationMap[Method]["args"]): Promise<ElectronApplicationOperationMap[Method]["result"]> {
        const response = await ipcRenderer.invoke(ELECTRON_IPC_CHANNEL.invoke, { method, args } as ElectronInvokeRequest) as ElectronInvokeResult<Method>;
        if (!response.ok)
            throw clientError(response.error);

        return response.value;
    }

    return {
        getHealth: () => invoke(ELECTRON_APPLICATION_METHOD.getHealth),
        getApplicationSettings: () => invoke(ELECTRON_APPLICATION_METHOD.getApplicationSettings),
        updateGeneralSettings: (input) => invoke(ELECTRON_APPLICATION_METHOD.updateGeneralSettings, input),
        updateBackupPolicy: (input) => invoke(ELECTRON_APPLICATION_METHOD.updateBackupPolicy, input),
        updateKeyBindingOverrides: (input) => invoke(ELECTRON_APPLICATION_METHOD.updateKeyBindingOverrides, input),
        addOpenAiConnection: (input) => invoke(ELECTRON_APPLICATION_METHOD.addOpenAiConnection, input),
        updateOpenAiConnection: (connectionId, input) => invoke(ELECTRON_APPLICATION_METHOD.updateOpenAiConnection, connectionId, input),
        removeOpenAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.removeOpenAiConnection, connectionId),
        setActiveOpenAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.setActiveOpenAiConnection, connectionId),
        testOpenAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.testOpenAiConnection, connectionId),
        refreshOpenAiModels: () => invoke(ELECTRON_APPLICATION_METHOD.refreshOpenAiModels),
        updateModelPreferences: (input) => invoke(ELECTRON_APPLICATION_METHOD.updateModelPreferences, input),
        listArticles: () => invoke(ELECTRON_APPLICATION_METHOD.listArticles),
        createArticle: (input) => invoke(ELECTRON_APPLICATION_METHOD.createArticle, input),
        updateArticle: (articleId, input) => invoke(ELECTRON_APPLICATION_METHOD.updateArticle, articleId, input),
        deleteArticle: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.deleteArticle, articleId),
        saveArticleDraft: (articleId, input) => invoke(ELECTRON_APPLICATION_METHOD.saveArticleDraft, articleId, input),
        discardArticleDraft: (articleId, expectedDraftVersion) => invoke(ELECTRON_APPLICATION_METHOD.discardArticleDraft, articleId, expectedDraftVersion),
        saveArticleRevision: (articleId, input) => invoke(ELECTRON_APPLICATION_METHOD.saveArticleRevision, articleId, input),
        listArticleRevisions: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.listArticleRevisions, articleId),
        acceptProposal: (articleId, input) => invoke(ELECTRON_APPLICATION_METHOD.acceptProposal, articleId, input),
        restoreRevision: (articleId, revisionId) => invoke(ELECTRON_APPLICATION_METHOD.restoreRevision, articleId, revisionId),
        listAssistantMessages: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.listAssistantMessages, articleId),
        streamAssistantRequest: (articleId, input, onEvent, signal) => {
            const streamId = createStreamId();

            return createStream<import("@skladno/shared").AssistantEvent>(ipcRenderer, streamId, { streamId, kind: "assistant", articleId, input }, onEvent, signal);
        },
        getStyleCorpus: () => invoke(ELECTRON_APPLICATION_METHOD.getStyleCorpus),
        addStyleCorpusItem: (input) => invoke(ELECTRON_APPLICATION_METHOD.addStyleCorpusItem, input),
        removeStyleCorpusItem: (materialId) => invoke(ELECTRON_APPLICATION_METHOD.removeStyleCorpusItem, materialId),
        getPublishLimitProfile: () => invoke(ELECTRON_APPLICATION_METHOD.getPublishLimitProfile),
        setPublishLimitProfile: (profileId) => invoke(ELECTRON_APPLICATION_METHOD.setPublishLimitProfile, profileId),
        streamEditorial: (articleId, input, onEvent, signal) => {
            const streamId = createStreamId();

            return createStream<import("@skladno/shared").EditorialEvent>(ipcRenderer, streamId, { streamId, kind: "editorial", articleId, input }, onEvent, signal);
        },
    };
}


export function exposeElectronApplicationClient(ipcRenderer: ElectronIpcRenderer, contextBridge: ElectronContextBridge, name = "skladno"): void {
    contextBridge.exposeInMainWorld(name, createElectronApplicationClient(ipcRenderer));
}
