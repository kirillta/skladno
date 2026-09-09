import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ArticleDraftConflictError, ArticleRevisionConflictError, type Article, type UpdateArticleInput } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import type { Notifications } from "../../notifications/notifications.js";
import { hydrateDraftLifecycle } from "../drafts/draft-lifecycle.js";
import { type useDraftLifecycle } from "../drafts/useDraftLifecycle.js";
import { sortArticlesByActivity, withoutDraft } from "./article-workspace-articles.js";


type DraftLifecycle = ReturnType<typeof useDraftLifecycle>;
type ReplaceArticles = (update: (items: Article[]) => Article[]) => void;


interface ArticleWorkspaceActionsOptions {
    client: EditorialWorkspaceClient;
    articlesRef: MutableRefObject<Article[]>;
    draftLifecycle: DraftLifecycle;
    timers: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
    checkpoint: (articleId: string, content?: string) => Promise<void>;
    replaceArticles: ReplaceArticles;
    selectedArticleId: string | undefined;
    setSelectedArticleId: Dispatch<SetStateAction<string | undefined>>;
    setPersistedSelectedArticleId: (articleId: string | undefined) => void;
    comparisonArticleId: string | undefined;
    setComparisonArticleId: Dispatch<SetStateAction<string | undefined>>;
    recordConflict: (articleId: string, error: ArticleDraftConflictError | ArticleRevisionConflictError, localContent: string) => void;
    notifyError: Notifications["notifyError"];
    saveFailedMessage: string;
}


export function createArticleWorkspaceActions(options: ArticleWorkspaceActionsOptions) {
    const {
        client, articlesRef, draftLifecycle, timers, checkpoint, replaceArticles, selectedArticleId,
        setSelectedArticleId, setPersistedSelectedArticleId, comparisonArticleId, setComparisonArticleId,
        recordConflict, notifyError, saveFailedMessage,
    } = options;


    async function resolveConflict(mode: "keep" | "draft" | "revision") {
        if (!comparisonArticleId)
            return;

        const session = draftLifecycle.sessionsRef.current[comparisonArticleId];
        const conflict = session?.conflict;
        if (!conflict)
            return;

        try {
            if (mode === "keep") {
                draftLifecycle.send({ articleId: comparisonArticleId, event: { type: "keep-local", baseRevisionId: conflict.article.currentRevisionId, ...(conflict.draft ? { draftVersion: conflict.draft.version } : {}) } });
                await checkpoint(comparisonArticleId, conflict.localContent);
            } else if (mode === "draft" && conflict.draft) {
                draftLifecycle.send({ articleId: comparisonArticleId, event: { type: "use-retained-draft", content: conflict.draft.content, baseRevisionId: conflict.article.currentRevisionId, draftVersion: conflict.draft.version } });
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? conflict.article : article));
            } else if (mode === "revision") {
                if (conflict.draft)
                    await client.discardArticleDraft(comparisonArticleId, conflict.draft.version);

                draftLifecycle.send({ articleId: comparisonArticleId, event: { type: "use-current-revision", content: conflict.article.currentRevision.content, revisionId: conflict.article.currentRevisionId } });
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? withoutDraft(conflict.article) : article));
            }

            setComparisonArticleId(undefined);
        } catch (error) {
            if (error instanceof ArticleDraftConflictError || error instanceof ArticleRevisionConflictError)
                recordConflict(comparisonArticleId, error, conflict.localContent);
            else
                notifyError(error, { fallbackMessage: saveFailedMessage });
        }
    }


    async function create(input: Parameters<EditorialWorkspaceClient["createArticle"]>[0]) {
        const article = await client.createArticle(input);
        replaceArticles((items) => [article, ...items]);
        draftLifecycle.replace({ ...draftLifecycle.sessionsRef.current, [article.id]: hydrateDraftLifecycle(article) });
        setSelectedArticleId(article.id);
        setPersistedSelectedArticleId(article.id);

        return article;
    }


    async function updateArticle(articleId: string, input: UpdateArticleInput) {
        const article = await client.updateArticle(articleId, input);
        replaceArticles((items) => items.map((item) => item.id === articleId ? article : item));
    }


    async function refreshArticle(articleId: string) {
        const article = (await client.listArticles()).find((item) => item.id === articleId);
        if (article)
            replaceArticles((items) => items.map((item) => item.id === articleId ? article : item));
    }


    async function remove(articleId: string) {
        const target = articlesRef.current.find((article) => article.id === articleId);
        const rootId = target?.sourceArticleId ?? articleId;
        const removedIds = new Set(articlesRef.current.filter((article) => article.id === rootId || article.sourceArticleId === rootId).map((article) => article.id));
        await client.deleteArticle(articleId);
        const nextSelectedArticleId = selectedArticleId && removedIds.has(selectedArticleId)
            ? sortArticlesByActivity(articlesRef.current.filter((item) => !removedIds.has(item.id) && !item.archived))[0]?.id
            : selectedArticleId;
        removedIds.forEach((id) => {
            clearTimeout(timers.current.get(id));
            delete draftLifecycle.sessionsRef.current[id];
        });
        replaceArticles((items) => items.filter((item) => !removedIds.has(item.id)));

        if (selectedArticleId && removedIds.has(selectedArticleId)) {
            setSelectedArticleId(nextSelectedArticleId);
            setPersistedSelectedArticleId(nextSelectedArticleId);
        }
    }


    async function setArchived(articleId: string, archived: boolean) {
        const target = articlesRef.current.find((article) => article.id === articleId);
        const rootId = target?.sourceArticleId ?? articleId;
        const group = articlesRef.current.filter((article) => article.id === rootId || article.sourceArticleId === rootId);
        await Promise.all(group.map((article) => checkpoint(article.id)));

        const updated = await client.setArticleArchived(articleId, archived);
        const updatedIds = new Set(updated.map((article) => article.id));
        replaceArticles((items) => items.map((article) => updated.find((item) => item.id === article.id) ?? article));

        if (archived && selectedArticleId && updatedIds.has(selectedArticleId)) {
            const next = sortArticlesByActivity(articlesRef.current.filter((article) => !article.archived))[0]?.id;
            setSelectedArticleId(next);
            setPersistedSelectedArticleId(next);
        }
    }


    async function setPinned(articleId: string, pinned: boolean) {
        const updated = await client.setArticlePinned(articleId, pinned);
        replaceArticles((items) => items.map((article) => article.id === updated.id ? updated : article));
    }


    async function reorderPinned(articleIds: string[]) {
        const updated = await client.reorderPinnedArticles(articleIds);
        replaceArticles(() => updated);
    }


    return { resolveConflict, create, updateArticle, refreshArticle, remove, setArchived, setPinned, reorderPinned };
}
