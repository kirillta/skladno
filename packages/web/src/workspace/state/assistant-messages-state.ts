import { useIntl } from "react-intl";
import type { AssistantEditorialResult } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { type AssistantSelectionScope } from "./assistant-selection.js";
import { useAssistantMessageHistory } from "./assistant-message-history-state.js";
import { useAssistantRequestActions, useAssistantRequestStore } from "./assistant-request-state.js";
import { useAssistantStreamEvents } from "./assistant-stream-events-state.js";

export { assistantSelectionScope, requestedTranslationLanguages, type AssistantSelectionScope } from "./assistant-selection.js";
export type { StreamedAssistantMessage } from "./assistant-streaming.js";


export function useAssistantMessages(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState, selection: AssistantSelectionScope | undefined, onResult: (articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => void, profileRebuilt?: { articleId: string; count: number; token: number }) {
    const intl = useIntl();
    const store = useAssistantRequestStore();
    const article = workspace.selectedArticle;
    const { reload } = useAssistantMessageHistory({ client, articleId: article?.id, profileRebuilt, store });
    const { clearStream, handleAssistantEvent } = useAssistantStreamEvents({ articleId: article?.id, workspace, store, onResult });
    const { request, retry } = useAssistantRequestActions({ client, workspace, selection, intl, store, reload, clearStream, handleAssistantEvent });

    return {
        messages: article ? store.messagesByArticle[article.id] : undefined,
        state: article ? store.stateByArticle[article.id] ?? "idle" : "idle",
        message: article ? store.messageByArticle[article.id] ?? "" : "",
        errorDetails: article ? store.errorDetailsByArticle[article.id] : undefined,
        hasUnavailableAiConnection: article ? store.aiConnectionUnavailableByArticle[article.id] ?? false : false,
        activity: article ? store.activityByArticle[article.id] : undefined,
        streamedMessage: article ? store.streamedMessagesByArticle[article.id] : undefined,
        factCheckClaims: article ? store.factCheckClaimsByArticle[article.id] : undefined,
        request, retry,
        cancel: () => store.controller.current?.abort(),
    };
}


export type AssistantMessagesState = ReturnType<typeof useAssistantMessages>;
