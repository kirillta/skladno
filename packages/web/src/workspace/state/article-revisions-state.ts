import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { Article, ArticleRevision } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";


export function useArticleRevisions(client: EditorialWorkspaceClient, article: Article | undefined, updateRevision: (articleId: string, revision: ArticleRevision) => void, saveDraft: (articleId: string) => Promise<unknown>, discardDraft: (articleId: string) => Promise<void>) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [revisions, setRevisions] = useState<ArticleRevision[]>([]);
    const [candidate, setCandidate] = useState<ArticleRevision>();
    const articleId = article?.id;
    const currentRevisionId = article?.currentRevisionId;

    useEffect(() => {
        let cancelled = false;
        if (!articleId) {
            setRevisions([]);
            return () => {
                cancelled = true;
            };
        }

        void client.listArticleRevisions(articleId).then((items) => {
            if (!cancelled)
                setRevisions(items);
        }).catch((error) => {
            if (!cancelled)
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.revisionHistoryFailed" }) });
        });

        return () => {
            cancelled = true;
        };
    }, [articleId, currentRevisionId, client, intl, notifyError]);


    async function restore(mode: "keep" | "save" | "discard") {
        if (!article || !candidate)
            return;

        try {
            if (mode === "save")
                await saveDraft(article.id);

            if (mode === "discard")
                await discardDraft(article.id);

            const revision = await client.restoreRevision(article.id, candidate.id);
            updateRevision(article.id, revision);
            setRevisions((items) => [...items, revision]);
            setCandidate(undefined);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.restoreRevisionFailed" }) });
        }
    }


    return { revisions, candidate, setCandidate, restore };
}


export type ArticleRevisionsState = ReturnType<typeof useArticleRevisions>;
