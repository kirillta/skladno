import { useCallback, useEffect } from "react";
import { ASSISTANT_EVENT, type AssistantEditorialResult, type AssistantEvent } from "@skladno/shared";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import type { AssistantRequestStore } from "./assistant-request-state.js";
import { updateStreamedMessage } from "./assistant-streaming.js";


interface AssistantStreamEventsOptions {
    articleId: string | undefined;
    workspace: ArticleWorkspaceState;
    store: AssistantRequestStore;
    onResult: (articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => void;
}


export function useAssistantStreamEvents({ articleId, workspace, store, onResult }: AssistantStreamEventsOptions) {
    const { streamBuffers, setActivityByArticle, setFactCheckClaimsByArticle, setStreamedMessagesByArticle } = store;
    const clearStream = useCallback((id: string) => {
        delete streamBuffers.current[id];
        setStreamedMessagesByArticle((current) => {
            const next = { ...current };
            delete next[id];

            return next;
        });
    }, [setStreamedMessagesByArticle, streamBuffers]);

    useEffect(() => {
        streamBuffers.current = {};
        setStreamedMessagesByArticle({});
    }, [articleId, setStreamedMessagesByArticle, streamBuffers]);

    const handleAssistantEvent = useCallback((event: AssistantEvent, id: string, revisionId: string, streamedId: string) => {
        if (event.type === ASSISTANT_EVENT.CAPABILITY_ACTIVITY)
            setActivityByArticle((current) => ({ ...current, [id]: event.activity }));

        if (event.type === ASSISTANT_EVENT.TOOL_STATUS && event.claims) {
            const { claims } = event;
            setFactCheckClaimsByArticle((current) => ({ ...current, [id]: claims }));
        }

        if (event.type === ASSISTANT_EVENT.COMPLETED && event.result) {
            const result = event.result;
            onResult(id, revisionId, result, event.editorialArtifactId);
            if (result.metadataChanged)
                void workspace.refreshArticle(id).catch(() => undefined);

            if (result.factCheck) {
                const { factCheck } = result;
                setFactCheckClaimsByArticle((claims) => ({ ...claims, [id]: factCheck.findings.map(({ claim }) => ({ claim, checked: true })) }));
            }
        }

        updateStreamedMessage({
            event, articleId: id, streamedId, buffers: streamBuffers.current,
            update: (next) => setStreamedMessagesByArticle((current) => ({ ...current, [id]: { ...next, createdAt: current[id]?.createdAt ?? next.createdAt } })),
        });
    }, [onResult, setActivityByArticle, setFactCheckClaimsByArticle, setStreamedMessagesByArticle, streamBuffers, workspace]);

    return { clearStream, handleAssistantEvent };
}
