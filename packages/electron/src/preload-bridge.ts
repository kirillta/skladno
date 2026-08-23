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


type ElectronStreamSubscription =
    | {
        kind: "assistant";
        request: Extract<ElectronStreamRequest, { kind: "assistant" }>;
        onEvent: (event: Extract<ElectronStreamEvent, { kind: "assistant" }>["event"]) => void;
    }
    | {
        kind: "editorial";
        request: Extract<ElectronStreamRequest, { kind: "editorial" }>;
        onEvent: (event: Extract<ElectronStreamEvent, { kind: "editorial" }>["event"]) => void;
    };


function createStream(
    ipcRenderer: ElectronIpcRenderer,
    subscription: ElectronStreamSubscription,
    signal?: AbortSignal,
): Promise<void> {
    if (signal?.aborted)
        return Promise.reject(abortError());

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const listener = (_event: unknown, payload: ElectronStreamEvent) => {
            if (payload.streamId !== subscription.request.streamId || payload.kind !== subscription.kind)
                return;

            switch (subscription.kind) {
                case "assistant":
                    if (payload.kind !== "assistant")
                        return;

                    subscription.onEvent(payload.event);
                    break;
                case "editorial":
                    if (payload.kind !== "editorial")
                        return;

                    subscription.onEvent(payload.event);
                    break;
            }

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
            ipcRenderer.send(ELECTRON_IPC_CHANNEL.cancel, { streamId: subscription.request.streamId });
            cleanup();
            reject(abortError());
        };

        ipcRenderer.on(ELECTRON_IPC_CHANNEL.streamEvent, listener);
        signal?.addEventListener("abort", abort, { once: true });
        ipcRenderer.send(ELECTRON_IPC_CHANNEL.stream, subscription.request);
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
        addAiConnection: (input) => invoke(ELECTRON_APPLICATION_METHOD.addAiConnection, input),
        updateAiConnection: (connectionId, input) => invoke(ELECTRON_APPLICATION_METHOD.updateAiConnection, connectionId, input),
        removeAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.removeAiConnection, connectionId),
        setActiveAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.setActiveAiConnection, connectionId),
        testAiConnection: (connectionId) => invoke(ELECTRON_APPLICATION_METHOD.testAiConnection, connectionId),
        refreshAiModels: () => invoke(ELECTRON_APPLICATION_METHOD.refreshAiModels),
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
        summarizeProposal: (articleId, input) => invoke(ELECTRON_APPLICATION_METHOD.summarizeProposal, articleId, input),
        restoreRevision: (articleId, revisionId) => invoke(ELECTRON_APPLICATION_METHOD.restoreRevision, articleId, revisionId),
        listAssistantMessages: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.listAssistantMessages, articleId),
        listFactChecks: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.listFactChecks, articleId),
        resolveFactCheckFinding: (articleId, occurrenceId, resolution) => invoke(ELECTRON_APPLICATION_METHOD.resolveFactCheckFinding, articleId, occurrenceId, resolution),
        streamAssistantRequest: (articleId, input, onEvent, signal) => {
            const streamId = createStreamId();

            return createStream(ipcRenderer, { kind: "assistant", request: { streamId, kind: "assistant", articleId, input }, onEvent }, signal);
        },
        getStyleCorpus: () => invoke(ELECTRON_APPLICATION_METHOD.getStyleCorpus),
        addStyleCorpusItem: (input) => invoke(ELECTRON_APPLICATION_METHOD.addStyleCorpusItem, input),
        setStyleCorpusItemIncluded: (id, included) => invoke(ELECTRON_APPLICATION_METHOD.setStyleCorpusItemIncluded, id, included),
        setStyleCorpusRules: (rules) => invoke(ELECTRON_APPLICATION_METHOD.setStyleCorpusRules, rules),
        rebuildStyleCorpus: () => invoke(ELECTRON_APPLICATION_METHOD.rebuildStyleCorpus),
        getArticleStyleRules: (articleId) => invoke(ELECTRON_APPLICATION_METHOD.getArticleStyleRules, articleId),
        setArticleStyleRules: (articleId, rules) => invoke(ELECTRON_APPLICATION_METHOD.setArticleStyleRules, articleId, rules),
        addArticleRevisionStyleCorpusItem: (articleId, revisionId) => invoke(ELECTRON_APPLICATION_METHOD.addArticleRevisionStyleCorpusItem, articleId, revisionId),
        removeStyleCorpusItem: (materialId) => invoke(ELECTRON_APPLICATION_METHOD.removeStyleCorpusItem, materialId),
        getPublishingSettings: () => invoke(ELECTRON_APPLICATION_METHOD.getPublishingSettings),
        setPublishingSettings: (settings) => invoke(ELECTRON_APPLICATION_METHOD.setPublishingSettings, settings),
        streamEditorial: (articleId, input, onEvent, signal) => {
            const streamId = createStreamId();

            return createStream(ipcRenderer, { kind: "editorial", request: { streamId, kind: "editorial", articleId, input }, onEvent }, signal);
        },
    };
}


export function exposeElectronApplicationClient(ipcRenderer: ElectronIpcRenderer, contextBridge: ElectronContextBridge, name = "skladno"): void {
    contextBridge.exposeInMainWorld(name, createElectronApplicationClient(ipcRenderer));
}
