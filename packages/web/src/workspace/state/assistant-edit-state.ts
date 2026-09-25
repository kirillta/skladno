import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { AssistantEditMode } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../../application/client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";


export function useAssistantEdits(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState, articleId: string | undefined, reload: (id: string) => Promise<void>) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [modeByArticle, setModeByArticle] = useState<Record<string, AssistantEditMode>>({});

    useEffect(() => {
        if (!articleId)
            return;

        let cancelled = false;
        void client.getAssistantEditMode(articleId).then((mode) => {
            if (!cancelled)
                setModeByArticle((current) => ({ ...current, [articleId]: mode }));
        }).catch((error) => {
            if (!cancelled)
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.assistantEditInvalid" }) });
        });
        return () => {
            cancelled = true;
        };
    }, [articleId, client, intl, notifyError]);

    const setEditMode = useCallback(async (mode: AssistantEditMode) => {
        if (!articleId)
            return;

        try {
            const saved = await client.setAssistantEditMode(articleId, mode);
            setModeByArticle((current) => ({ ...current, [articleId]: saved }));
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.assistantEditInvalid" }) });
        }
    }, [articleId, client, intl, notifyError]);

    const applyEdit = useCallback(async (messageId: string) => {
        if (!articleId)
            return;

        try {
            const revision = await client.applyAssistantEdit(articleId, messageId);
            workspace.updateRevision(articleId, revision);
            await reload(articleId);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.assistantEditInvalid" }) });
        }
    }, [articleId, client, intl, notifyError, reload, workspace]);

    return { editMode: articleId ? modeByArticle[articleId] : undefined, setEditMode, applyEdit };
}
