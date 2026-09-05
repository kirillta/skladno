import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { IntlShape } from "react-intl";
import { APPLICATION_ERROR, ApplicationClientError, type AssistantCapabilityActivity, type AssistantEvent, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { errorMessageId } from "../../i18n/errors.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { providerLanguageName } from "./editorial-language.js";
import { fingerprintArticleContent, requestedTranslationLanguages, type AssistantSelectionScope } from "./assistant-selection.js";
import type { StreamBuffer, StreamedAssistantMessage } from "./assistant-streaming.js";


export type ProposalState = "idle" | "streaming" | "error";


type Setter<T> = Dispatch<SetStateAction<T>>;


export interface AssistantRequestStore {
    messagesByArticle: Record<string, AssistantMessage[]>;
    setMessagesByArticle: Setter<Record<string, AssistantMessage[]>>;
    stateByArticle: Record<string, ProposalState>;
    setStateByArticle: Setter<Record<string, ProposalState>>;
    messageByArticle: Record<string, string>;
    setMessageByArticle: Setter<Record<string, string>>;
    errorDetailsByArticle: Record<string, string>;
    setErrorDetailsByArticle: Setter<Record<string, string>>;
    aiConnectionUnavailableByArticle: Record<string, boolean>;
    setAiConnectionUnavailableByArticle: Setter<Record<string, boolean>>;
    factCheckClaimsByArticle: Record<string, FactCheckClaimPreview[]>;
    setFactCheckClaimsByArticle: Setter<Record<string, FactCheckClaimPreview[]>>;
    activityByArticle: Record<string, AssistantCapabilityActivity>;
    setActivityByArticle: Setter<Record<string, AssistantCapabilityActivity>>;
    streamedMessagesByArticle: Record<string, StreamedAssistantMessage>;
    setStreamedMessagesByArticle: Setter<Record<string, StreamedAssistantMessage>>;
    controller: MutableRefObject<AbortController | undefined>;
    streamBuffers: MutableRefObject<Record<string, StreamBuffer>>;
}


export function useAssistantRequestStore(): AssistantRequestStore {
    const [messagesByArticle, setMessagesByArticle] = useState<Record<string, AssistantMessage[]>>({});
    const [stateByArticle, setStateByArticle] = useState<Record<string, ProposalState>>({});
    const [messageByArticle, setMessageByArticle] = useState<Record<string, string>>({});
    const [errorDetailsByArticle, setErrorDetailsByArticle] = useState<Record<string, string>>({});
    const [aiConnectionUnavailableByArticle, setAiConnectionUnavailableByArticle] = useState<Record<string, boolean>>({});
    const [factCheckClaimsByArticle, setFactCheckClaimsByArticle] = useState<Record<string, FactCheckClaimPreview[]>>({});
    const [activityByArticle, setActivityByArticle] = useState<Record<string, AssistantCapabilityActivity>>({});
    const [streamedMessagesByArticle, setStreamedMessagesByArticle] = useState<Record<string, StreamedAssistantMessage>>({});
    const controller = useRef<AbortController>();
    const streamBuffers = useRef<Record<string, StreamBuffer>>({});

    return {
        messagesByArticle, setMessagesByArticle, stateByArticle, setStateByArticle,
        messageByArticle, setMessageByArticle, errorDetailsByArticle, setErrorDetailsByArticle,
        aiConnectionUnavailableByArticle, setAiConnectionUnavailableByArticle,
        factCheckClaimsByArticle, setFactCheckClaimsByArticle, activityByArticle, setActivityByArticle,
        streamedMessagesByArticle, setStreamedMessagesByArticle, controller, streamBuffers,
    };
}


function aiConnectionUnavailable(error: unknown): boolean {
    return error instanceof ApplicationClientError && (error.code === APPLICATION_ERROR.ACTIVE_CONNECTION_REQUIRED
        || error.code === APPLICATION_ERROR.AI_CONNECTION_NOT_FOUND
        || error.code === APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING);
}


interface AssistantRequestActionsOptions {
    client: EditorialWorkspaceClient;
    workspace: ArticleWorkspaceState;
    selection: AssistantSelectionScope | undefined;
    intl: IntlShape;
    store: AssistantRequestStore;
    reload: (articleId: string) => Promise<void>;
    clearStream: (articleId: string) => void;
    handleAssistantEvent: (event: AssistantEvent, articleId: string, revisionId: string, streamedId: string) => void;
}


function removeArticleValue<T>(setValue: Setter<Record<string, T>>, articleId: string) {
    setValue((current) => {
        const next = { ...current };
        delete next[articleId];
        return next;
    });
}


function clearNewRequestFeedback(store: AssistantRequestStore, articleId: string) {
    removeArticleValue(store.setMessageByArticle, articleId);
    removeArticleValue(store.setErrorDetailsByArticle, articleId);
    removeArticleValue(store.setAiConnectionUnavailableByArticle, articleId);
    removeArticleValue(store.setActivityByArticle, articleId);
}


function clearRetryFeedback(store: AssistantRequestStore, articleId: string) {
    store.setMessageByArticle((messages) => ({ ...messages, [articleId]: "" }));
    removeArticleValue(store.setErrorDetailsByArticle, articleId);
    removeArticleValue(store.setAiConnectionUnavailableByArticle, articleId);
}


async function finishRequest({ articleId, store, reload, clearStream }: Pick<AssistantRequestActionsOptions, "store" | "reload" | "clearStream"> & { articleId: string }) {
    await reload(articleId);
    clearStream(articleId);
    store.setStateByArticle((states) => ({ ...states, [articleId]: "idle" }));
}


async function recoverRequest({ articleId, error, intl, store, reload, clearStream }: Pick<AssistantRequestActionsOptions, "intl" | "store" | "reload" | "clearStream"> & { articleId: string; error: unknown }) {
    if (error instanceof DOMException && error.name === "AbortError") {
        await reload(articleId).catch(() => undefined);
        clearStream(articleId);
        store.setStateByArticle((states) => ({ ...states, [articleId]: "idle" }));
        return;
    }

    store.setStateByArticle((states) => ({ ...states, [articleId]: "error" }));
    store.setMessageByArticle((messages) => ({ ...messages, [articleId]: intl.formatMessage({ id: "assistant.requestStartFailed" }) }));
    store.setErrorDetailsByArticle((details) => ({
        ...details,
        [articleId]: error instanceof ApplicationClientError
            ? intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters)
            : intl.formatMessage({ id: "errors.editorialRequestFailed" }),
    }));

    store.setAiConnectionUnavailableByArticle((connections) => ({ ...connections, [articleId]: aiConnectionUnavailable(error) }));
    await reload(articleId).catch(() => undefined);
    clearStream(articleId);
}


async function runRequest({ articleId, perform, ...options }: AssistantRequestActionsOptions & { articleId: string; perform: () => Promise<void> }) {
    try {
        await perform();
        await finishRequest({ articleId, ...options });
    } catch (error) {
        await recoverRequest({ articleId, error, ...options });
    }
}


function appendPendingMessage({ store, articleId, requestId, authorMessage, explicitSkillId, skillOffset, selection }: {
    store: AssistantRequestStore;
    articleId: string;
    requestId: string;
    authorMessage: string;
    explicitSkillId: BuiltInSkillId | undefined;
    skillOffset: number | undefined;
    selection: AssistantSelectionScope | undefined;
}) {
    const timestamp = new Date().toISOString();
    store.setMessagesByArticle((messages) => ({
        ...messages,
        [articleId]: [...(messages[articleId] ?? []), {
            id: `pending-${requestId}`, articleId, requestId, role: "author", kind: "message", status: "completed", content: authorMessage,
            ...(explicitSkillId ? { skillId: explicitSkillId } : {}),
            ...(skillOffset === undefined ? {} : { skillOffset }),
            ...(selection ? { selectionText: selection.preview } : {}),
            createdAt: timestamp, updatedAt: timestamp,
        }],
    }));
}


async function requestAssistant(options: AssistantRequestActionsOptions & { authorMessage: string; explicitSkillId?: BuiltInSkillId; targetLanguage?: string | readonly string[]; skillOffset?: number }): Promise<void> {
    const { workspace, targetLanguage, authorMessage, explicitSkillId, skillOffset } = options;
    const article = workspace.selectedArticle;
    if (!article)
        return;

    if (targetLanguage && typeof targetLanguage !== "string") {
        for (const language of requestedTranslationLanguages(authorMessage, targetLanguage))
            await requestAssistant({ ...options, targetLanguage: language });

        return;
    }

    await runRequest({
        ...options,
        articleId: article.id,
        perform: async () => {
            const saved = await workspace.save(article.id);
            const revision = saved ?? article.currentRevision;
            clearNewRequestFeedback(options.store, article.id);
            options.store.setStateByArticle((states) => ({ ...states, [article.id]: "streaming" }));
            options.store.setFactCheckClaimsByArticle((claims) => ({ ...claims, [article.id]: [] }));
            options.store.controller.current = new AbortController();
            const selectionMatchesRevision = options.selection && options.selection.articleId === article.id
                && options.selection.fingerprint === await fingerprintArticleContent(revision.content);
            if (options.selection && !selectionMatchesRevision)
                throw new ApplicationClientError("assistant_selection_invalid", undefined, 400);

            const matchingSelection = selectionMatchesRevision ? options.selection : undefined;
            const requestId = crypto.randomUUID();
            const streamedId = `streaming-${crypto.randomUUID()}`;
            appendPendingMessage({ store: options.store, articleId: article.id, requestId, authorMessage, explicitSkillId, skillOffset, selection: matchingSelection });
            await options.client.streamAssistantRequest(article.id, {
                kind: "new", requestId, authorMessage,
                scope: matchingSelection
                    ? { kind: "selection", baseRevisionId: revision.id, startOffset: matchingSelection.startOffset, endOffset: matchingSelection.endOffset }
                    : { kind: "article", baseRevisionId: revision.id },
                ...(explicitSkillId ? { explicitSkillId } : {}),
                ...(skillOffset === undefined ? {} : { skillOffset }),
                ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}),
            }, (event) => options.handleAssistantEvent(event, article.id, revision.id, streamedId), options.store.controller.current.signal);
        },
    });
}


async function retryAssistant(options: AssistantRequestActionsOptions & { retryOfRequestId: string }): Promise<void> {
    const article = options.workspace.selectedArticle;
    if (!article)
        return;

    await runRequest({
        ...options,
        articleId: article.id,
        perform: async () => {
            clearRetryFeedback(options.store, article.id);
            options.store.setStateByArticle((states) => ({ ...states, [article.id]: "streaming" }));
            options.store.controller.current = new AbortController();
            const streamedId = `streaming-${crypto.randomUUID()}`;
            await options.client.streamAssistantRequest(article.id, {
                kind: "retry", requestId: crypto.randomUUID(), retryOfRequestId: options.retryOfRequestId,
            }, (event) => options.handleAssistantEvent(event, article.id, article.currentRevisionId, streamedId), options.store.controller.current.signal);
        },
    });
}


export function useAssistantRequestActions(options: AssistantRequestActionsOptions) {
    const request = useCallback((authorMessage: string, explicitSkillId?: BuiltInSkillId, targetLanguage?: string | readonly string[], skillOffset?: number) => requestAssistant({ ...options, authorMessage, explicitSkillId, targetLanguage, skillOffset }), [options]);
    const retry = useCallback((retryOfRequestId: string) => retryAssistant({ ...options, retryOfRequestId }), [options]);
    return { request, retry };
}
