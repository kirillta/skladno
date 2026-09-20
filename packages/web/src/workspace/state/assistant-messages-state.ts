import { useIntl } from "react-intl";
import { useCallback, useState } from "react";
import type { AssistantCheckpointDraftMode, AssistantCheckpointPreview, AssistantEditorialResult, RestoreAssistantCheckpointResult } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { type AssistantSelectionScope } from "./assistant-selection.js";
import { useAssistantMessageHistory } from "./assistant-message-history-state.js";
import { useAssistantRequestActions, useAssistantRequestStore } from "./assistant-request-state.js";
import { useAssistantStreamEvents } from "./assistant-stream-events-state.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";

export { getAssistantSelectionScope, requestedTranslationLanguages, type AssistantSelectionScope } from "./assistant-selection.js";
export type { StreamedAssistantMessage } from "./assistant-streaming.js";


export function useAssistantMessages(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState, selection: AssistantSelectionScope | undefined, onResult: (articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => void, profileRebuilt?: { articleId: string; count: number; token: number }) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const store = useAssistantRequestStore();
    const article = workspace.selectedArticle;
    const { reload } = useAssistantMessageHistory({ client, articleId: article?.id, profileRebuilt, store });
    const { clearStream, handleAssistantEvent } = useAssistantStreamEvents({ articleId: article?.id, workspace, store, onResult });
    const { request, retry } = useAssistantRequestActions({ client, workspace, selection, intl, store, reload, clearStream, handleAssistantEvent });
    const [checkpointPreview, setCheckpointPreview] = useState<AssistantCheckpointPreview>();
    const [restoredComposer, setRestoredComposer] = useState<RestoreAssistantCheckpointResult["composer"]>();
    const previewCheckpoint = useCallback(async (messageId: string) => {
        if (!article)
            return;

        store.controller.current?.abort();
        try {
            setCheckpointPreview(await client.previewAssistantCheckpoint(article.id, messageId));
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.assistantCheckpointInvalid" }) });
        }
    }, [article, client, intl, notifyError, store.controller]);
    const restoreCheckpoint = useCallback(async (draftMode?: AssistantCheckpointDraftMode) => {
        if (!article || !checkpointPreview)
            return;

        try {
            const result = await client.restoreAssistantCheckpoint(article.id, checkpointPreview.messageId, { tailToken: checkpointPreview.tailToken, ...(draftMode ? { draftMode } : {}) });
            store.setMessagesByArticle((current) => ({ ...current, [article.id]: result.messages }));
            clearStream(article.id);
            store.setStateByArticle((current) => ({ ...current, [article.id]: "idle" }));

            workspace.applyPersistedArticle(result.article);
            setRestoredComposer(result.composer);
            setCheckpointPreview(undefined);

            return result;
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.assistantCheckpointInvalid" }) });
            throw error;
        }
    }, [article, checkpointPreview, clearStream, client, intl, notifyError, store, workspace]);

    return {
        messages: article ? store.messagesByArticle[article.id] : undefined,
        state: article ? store.stateByArticle[article.id] ?? "idle" : "idle",
        message: article ? store.messageByArticle[article.id] ?? "" : "",
        errorDetails: article ? store.errorDetailsByArticle[article.id] : undefined,
        hasUnavailableAiConnection: article ? store.aiConnectionUnavailableByArticle[article.id] ?? false : false,
        activity: article ? store.activityByArticle[article.id] : undefined,
        streamedMessage: article ? store.streamedMessagesByArticle[article.id] : undefined,
        factCheckClaims: article ? store.factCheckClaimsByArticle[article.id] : undefined,
        request, retry, checkpointPreview, previewCheckpoint, restoreCheckpoint, closeCheckpoint: () => setCheckpointPreview(undefined), restoredComposer,
        reload,
        cancel: () => store.controller.current?.abort(),
    };
}


export type AssistantMessagesState = ReturnType<typeof useAssistantMessages>;
