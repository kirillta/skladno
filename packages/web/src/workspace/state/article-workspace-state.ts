import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ArticleDraftConflictError, ArticleRevisionConflictError, type Article, type ArticleRevision } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";
import {
    draftPresentationState,
    hasUncommittedDraftChanges,
    hydrateDraftLifecycle,
    type DraftPresentationState,
} from "../drafts/draft-lifecycle.js";
import { useDraftLifecycle } from "../drafts/useDraftLifecycle.js";


function articleActivityTimestamp(article: Article): string {
    return article.draft && article.draft.updatedAt > article.updatedAt ? article.draft.updatedAt : article.updatedAt;
}


export function sortArticlesByActivity(articles: Article[]): Article[] {
    return [...articles].sort((first, second) => articleActivityTimestamp(second).localeCompare(articleActivityTimestamp(first)) || first.id.localeCompare(second.id));
}


function withoutDraft(article: Article): Omit<Article, "draft"> {
    const { draft: _draft, ...result } = article;
    void _draft;
    return result;
}


export function articleContentForWorkspace(article: Article): string {
    if (article.draft?.baseRevisionId === article.currentRevisionId)
        return article.draft.content;

    return article.currentRevision.content;
}


export function useArticleWorkspace(client: EditorialWorkspaceClient, preferredSelectedArticleId: string | undefined, setPersistedSelectedArticleId: (articleId: string | undefined) => void) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string>();
    const draftLifecycle = useDraftLifecycle();
    const replaceDraftLifecycle = draftLifecycle.replace;
    const [comparisonArticleId, setComparisonArticleId] = useState<string>();
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState(() => intl.formatMessage({ id: "workspace.loadingArticles" }));
    const articlesRef = useRef<Article[]>([]);
    const queues = useRef(new Map<string, Promise<void>>());
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const checkpointRef = useRef<(articleId: string) => Promise<void>>(() => Promise.resolve());
    const preferredSelectedArticleIdRef = useRef(preferredSelectedArticleId);
    const setPersistedSelectedArticleIdRef = useRef(setPersistedSelectedArticleId);

    preferredSelectedArticleIdRef.current = preferredSelectedArticleId;
    setPersistedSelectedArticleIdRef.current = setPersistedSelectedArticleId;


    function replaceArticles(update: (items: Article[]) => Article[]) {
        setArticles((items) => {
            const next = sortArticlesByActivity(update(items));
            articlesRef.current = next;

            return next;
        });
    }


    useEffect(() => {
        client.listArticles().then((loaded) => {
            const sorted = sortArticlesByActivity(loaded);
            const preferredArticleId = preferredSelectedArticleIdRef.current;
            const selectedArticleId = sorted.some((article) => article.id === preferredArticleId) ? preferredArticleId : sorted[0]?.id;
            articlesRef.current = sorted;
            setArticles(sorted);
            replaceDraftLifecycle(Object.fromEntries(sorted.map((article) => [article.id, hydrateDraftLifecycle(article)])));
            setSelectedArticleId(selectedArticleId);
            setPersistedSelectedArticleIdRef.current(selectedArticleId);
            setState("ready");
        }).catch(() => {
            setState("error");
            setMessage(intl.formatMessage({ id: "workspace.serviceUnavailable" }));
        });
    }, [client, intl, replaceDraftLifecycle]);


    function recordConflict(articleId: string, error: ArticleDraftConflictError | ArticleRevisionConflictError, localContent: string) {
        const persistedDraft = error instanceof ArticleDraftConflictError ? error.draft : error.article.draft;
        draftLifecycle.send({
            articleId,
            event: {
                type: "conflicted",
                conflict: {
                    article: error.article,
                    draft: persistedDraft,
                    localContent,
                },
            },
        });
    }


    function checkpoint(articleId: string, content = draftLifecycle.sessionsRef.current[articleId]?.content ?? ""): Promise<void> {
        clearTimeout(timers.current.get(articleId));
        const session = draftLifecycle.sessionsRef.current[articleId];
        if (!session)
            return Promise.resolve();

        const generation = session.generation;
        const preceding = queues.current.get(articleId) ?? Promise.resolve();
        const task = preceding.then(async () => {
            const current = articlesRef.current.find((article) => article.id === articleId);
            const latest = draftLifecycle.sessionsRef.current[articleId];
            if (!current || !latest)
                return;

            draftLifecycle.send({ articleId, event: { type: "checkpoint-started", generation } });
            const expectedDraftVersion = latest.draftVersion;
            if (content === current.currentRevision.content) {
                if (expectedDraftVersion !== undefined) {
                    await client.discardArticleDraft(articleId, expectedDraftVersion);
                    replaceArticles((items) => items.map((article) => article.id === articleId ? withoutDraft(article) : article));
                }

                draftLifecycle.send({ articleId, event: { type: "checkpoint-discarded", generation } });

                return;
            }

            const savedDraft = await client.saveArticleDraft(articleId, {
                content,
                baseRevisionId: latest.baseRevisionId,
                ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion }),
            });
            replaceArticles((items) => items.map((article) => article.id === articleId ? { ...article, draft: savedDraft } : article));
            draftLifecycle.send({ articleId, event: { type: "checkpointed", generation, draftVersion: savedDraft.version } });
        }).catch((error: unknown) => {
            if (error instanceof ArticleDraftConflictError || error instanceof ArticleRevisionConflictError)
                recordConflict(articleId, error, draftLifecycle.sessionsRef.current[articleId]?.content ?? content);
            else
                draftLifecycle.send({ articleId, event: { type: "failed", operation: "checkpoint", generation } });

            throw error;
        });

        queues.current.set(articleId, task.then(() => undefined, () => undefined));

        return task;
    }


    function scheduleCheckpoint(articleId: string, content: string) {
        clearTimeout(timers.current.get(articleId));
        timers.current.set(articleId, setTimeout(() => void checkpoint(articleId, content).catch(() => undefined), 750));
    }


    checkpointRef.current = checkpoint;


    useEffect(() => {
        function saveWhenHidden() {
            if (document.visibilityState === "hidden" && selectedArticleId)
                void checkpointRef.current(selectedArticleId).catch(() => undefined);
        }


        document.addEventListener("visibilitychange", saveWhenHidden);

        return () => document.removeEventListener("visibilitychange", saveWhenHidden);
    }, [selectedArticleId]);


    useEffect(() => () => timers.current.forEach(clearTimeout), []);


    function updateRevision(articleId: string, revision: ArticleRevision) {
        draftLifecycle.send({ articleId, event: { type: "promoted", revisionId: revision.id, content: revision.content } });
        replaceArticles((items) => items.map((article) => article.id === articleId ? {
            ...withoutDraft(article),
            updatedAt: revision.createdAt,
            currentRevisionId: revision.id,
            currentRevision: revision,
        } : article));
    }


    async function save(articleId = selectedArticleId): Promise<ArticleRevision | undefined> {
        if (!articleId)
            return undefined;

        const session = draftLifecycle.sessionsRef.current[articleId];
        const current = articlesRef.current.find((article) => article.id === articleId);
        if (!current || !session)
            return undefined;

        if (current.currentRevision.content === session.content && session.draftVersion === undefined)
            return current.currentRevision;

        try {
            const content = session.content;
            await checkpoint(articleId, content);
            const checkpointed = draftLifecycle.sessionsRef.current[articleId];
            if (!checkpointed || checkpointed.content !== content || checkpointed.draftVersion === undefined)
                return undefined;

            draftLifecycle.send({ articleId, event: { type: "promotion-started" } });
            const revision = await client.saveArticleRevision(articleId, {
                content,
                baseRevisionId: checkpointed.baseRevisionId,
                expectedDraftVersion: checkpointed.draftVersion,
            });
            updateRevision(articleId, revision);
            return revision;
        } catch (error) {
            if (!(error instanceof ArticleDraftConflictError) && !(error instanceof ArticleRevisionConflictError))
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.saveFailed" }) });

            if (!(error instanceof ArticleDraftConflictError) && !(error instanceof ArticleRevisionConflictError)) {
                const currentSession = draftLifecycle.sessionsRef.current[articleId];
                if (currentSession)
                    draftLifecycle.send({ articleId, event: { type: "failed", operation: "promotion", generation: currentSession.generation } });
            }

            throw error;
        }
    }


    async function resolveConflict(mode: "keep" | "draft" | "revision") {
        if (!comparisonArticleId)
            return;

        const session = draftLifecycle.sessionsRef.current[comparisonArticleId];
        const conflict = session?.conflict;
        if (!conflict)
            return;

        try {
            if (mode === "keep") {
                draftLifecycle.send({
                    articleId: comparisonArticleId,
                    event: {
                        type: "keep-local",
                        baseRevisionId: conflict.article.currentRevisionId,
                        ...(conflict.draft ? { draftVersion: conflict.draft.version } : {}),
                    },
                });
                await checkpoint(comparisonArticleId, conflict.localContent);
            } else if (mode === "draft" && conflict.draft) {
                draftLifecycle.send({
                    articleId: comparisonArticleId,
                    event: {
                        type: "use-retained-draft",
                        content: conflict.draft.content,
                        baseRevisionId: conflict.article.currentRevisionId,
                        draftVersion: conflict.draft.version,
                    },
                });
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? conflict.article : article));
            } else if (mode === "revision") {
                if (conflict.draft)
                    await client.discardArticleDraft(comparisonArticleId, conflict.draft.version);

                draftLifecycle.send({
                    articleId: comparisonArticleId,
                    event: {
                        type: "use-current-revision",
                        content: conflict.article.currentRevision.content,
                        revisionId: conflict.article.currentRevisionId,
                    },
                });
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? withoutDraft(conflict.article) : article));
            }

            setComparisonArticleId(undefined);
        } catch (error) {
            if (error instanceof ArticleDraftConflictError || error instanceof ArticleRevisionConflictError)
                recordConflict(comparisonArticleId, error, conflict.localContent);
            else
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.saveFailed" }) });
        }
    }


    async function create(input: { title: string; content: string; language?: string; audience?: string; publishingProfileId?: string; sourceArticleId?: string; sourceRevisionId?: string }) {
        const article = await client.createArticle(input);
        replaceArticles((items) => [article, ...items]);
        draftLifecycle.replace({
            ...draftLifecycle.sessionsRef.current,
            [article.id]: hydrateDraftLifecycle(article),
        });
        setSelectedArticleId(article.id);
        setPersistedSelectedArticleId(article.id);

        return article;
    }


    async function updateArticle(articleId: string, input: import("@skladno/shared").UpdateArticleInput) {
        const article = await client.updateArticle(articleId, input);
        replaceArticles((items) => items.map((item) => item.id === articleId ? article : item));
    }


    async function remove(articleId: string) {
        await client.deleteArticle(articleId);
        replaceArticles((items) => {
            const next = items.filter((item) => item.id !== articleId);
            if (selectedArticleId === articleId) {
                setSelectedArticleId(next[0]?.id);
                setPersistedSelectedArticleId(next[0]?.id);
            }

            return next;
        });
    }


    async function discardDraft(articleId = selectedArticleId) {
        if (!articleId)
            return;

        const session = draftLifecycle.sessionsRef.current[articleId];
        const expectedDraftVersion = session?.draftVersion;
        if (expectedDraftVersion !== undefined)
            await client.discardArticleDraft(articleId, expectedDraftVersion);

        const current = articlesRef.current.find((article) => article.id === articleId);
        if (current) {
            draftLifecycle.send({
                articleId,
                event: {
                    type: "use-current-revision",
                    content: current.currentRevision.content,
                    revisionId: current.currentRevisionId,
                },
            });

            replaceArticles((items) => items.map((article) => article.id === articleId ? withoutDraft(article) : article));
        }
    }


    const selectedArticle = articles.find((article) => article.id === selectedArticleId);
    const selectedDraft = selectedArticleId ? draftLifecycle.sessions[selectedArticleId] : undefined;
    const content = selectedDraft?.content ?? "";
    return {
        articles,
        selectedArticle,
        selectedArticleId,
        selectArticle: (articleId: string) => {
            if (selectedArticleId && selectedArticleId !== articleId)
                void checkpoint(selectedArticleId).catch(() => undefined);

            setSelectedArticleId(articleId);
            setPersistedSelectedArticleId(articleId);
        },
        content,
        setContent: (value: string) => {
            if (!selectedArticleId)
                return;

            draftLifecycle.send({ articleId: selectedArticleId, event: { type: "edit", content: value } });
            scheduleCheckpoint(selectedArticleId, value);
        },
        state,
        message,
        saveState: selectedDraft ? draftPresentationState(selectedDraft) : "saved" as DraftPresentationState,
        save,
        retry: () => selectedArticleId ? checkpoint(selectedArticleId) : Promise.resolve(),
        flushSelected: () => selectedArticleId ? checkpoint(selectedArticleId) : Promise.resolve(),
        discardDraft,
        hasUncommittedChanges: Boolean(selectedArticle && selectedDraft && hasUncommittedDraftChanges(selectedDraft, selectedArticle.currentRevision.content)),
        conflict: selectedDraft?.conflict,
        comparisonArticleId,
        openComparison: () => selectedArticleId && setComparisonArticleId(selectedArticleId),
        closeComparison: () => setComparisonArticleId(undefined),
        resolveConflict,
        create,
        updateArticle,
        remove,
        updateRevision,
    };
}


export type ArticleWorkspaceState = ReturnType<typeof useArticleWorkspace>;
