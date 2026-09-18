import { useCallback, useEffect, useRef } from "react";
import type { EditorialWorkspaceClient } from "../../application/client.js";
import type { AssistantRequestStore } from "./assistant-request-state.js";


interface AssistantMessageHistoryOptions {
    client: Pick<EditorialWorkspaceClient, "listAssistantMessages">;
    articleId: string | undefined;
    profileRebuilt: { articleId: string; count: number; token: number } | undefined;
    store: Pick<AssistantRequestStore, "setMessagesByArticle">;
}


export function useAssistantMessageHistory({ client, articleId, profileRebuilt, store }: AssistantMessageHistoryOptions) {
    const { setMessagesByArticle } = store;
    const requestVersion = useRef(0);
    const reload = useCallback(async (id: string) => {
        const version = ++requestVersion.current;
        const messages = await client.listAssistantMessages(id);
        if (version === requestVersion.current)
            setMessagesByArticle((current) => ({ ...current, [id]: messages }));
    }, [client, setMessagesByArticle]);

    useEffect(() => {
        let cancelled = false;
        if (!articleId)
            return () => {
                cancelled = true;
            };

        const version = ++requestVersion.current;
        void client.listAssistantMessages(articleId)
            .then((messages) => {
                if (!cancelled && version === requestVersion.current)
                    setMessagesByArticle((current) => ({
                        ...current,
                        [articleId]: [...messages, ...(current[articleId] ?? [])
                            .filter((message) => message.id.startsWith("pending-") && !messages.some((item) => item.requestId === message.requestId))],
                    }));
            })
            .catch(() => {
                if (!cancelled && version === requestVersion.current)
                    setMessagesByArticle((current) => {
                        const remaining = { ...current };
                        delete remaining[articleId];
                        return remaining;
                    });
            });

        return () => {
            cancelled = true;
        };
    }, [articleId, client, setMessagesByArticle]);

    useEffect(() => {
        if (!articleId || !profileRebuilt || profileRebuilt.articleId !== articleId)
            return;

        const timestamp = new Date().toISOString();
        setMessagesByArticle((current) => ({
            ...current,
            [articleId]: [...(current[articleId] ?? []), {
                id: `profile-rebuilt-${profileRebuilt.token}`,
                articleId,
                role: "system",
                kind: "status",
                status: "completed",
                template: "profile_rebuilt",
                content: String(profileRebuilt.count),
                createdAt: timestamp,
                updatedAt: timestamp,
            }],
        }));
    }, [articleId, profileRebuilt, setMessagesByArticle]);

    return { reload };
}
