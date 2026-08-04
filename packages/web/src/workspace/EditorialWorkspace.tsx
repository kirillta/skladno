import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    createTextProposal,
    defaultGeneralSettings,
    defaultPublishLimitProfileId,
    getPublishLimitProfile,
    getPublishingLength,
    isPublishLimitProfileId,
    isArticleLanguage,
    preparePlainTextForPublishing,
    type Article,
    type ArticleRevision,
    type EditorialEvent,
    type EditorialOperation,
    type FactCheck,
    type GeneralSettings,
    type PublishLimitProfileId,
    type StyleCorpus,
    type AssistantEditorialResult,
    type AssistantMessage,
    type BuiltInSkillId,
    type StyleReview,
    type TranslationMetadata,
    KEY_BINDING_COMMAND,
    type KeyBindingOverrides,
} from "@skladno/shared";
import { ApplicationClientError, ArticleDraftConflictError, ArticleRevisionConflictError } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Banner } from "../ui/primitives.js";
import { EditorialAssistantPanel as ExtractedEditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleLibraryPanel as ExtractedArticleLibraryPanel } from "./components/ArticleLibraryPanel.js";
import { ArticleWorkspace as ExtractedArticleWorkspace } from "./components/ArticleWorkspace.js";
import { RestoreRevisionDialog as ExtractedRestoreRevisionDialog } from "./components/RestoreRevisionDialog.js";
import { WorkspaceShell as ExtractedWorkspaceShell } from "./components/WorkspaceShell.js";
import { ApplicationSettings } from "../settings/ApplicationSettings.js";
import { DraftConflictDialog } from "./components/DraftConflictDialog.js";
import type { KeyBindingDispatcher } from "../key-bindings/dispatcher.js";
import { errorMessageId } from "../i18n/errors.js";
import { useNotifications } from "../notifications/NotificationProvider.js";
import {
    draftPresentationState,
    hasUncommittedDraftChanges,
    hydrateDraftLifecycle,
    type DraftPresentationState,
} from "./drafts/draft-lifecycle.js";
import { useDraftLifecycle } from "./drafts/useDraftLifecycle.js";
import { isWorkspaceView, type WorkspaceView } from "./workspace-views.js";

export type { DraftConflict, DraftPresentationState as SaveState } from "./drafts/draft-lifecycle.js";
export type { WorkspaceView } from "./workspace-views.js";
type ProposalState = "idle" | "streaming" | "error";
interface EditorialResult<T> {
    articleId: string;
    baseRevisionId: string;
    value: T;
}

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



function useArticleWorkspace(client: EditorialWorkspaceClient, preferredSelectedArticleId: string | undefined, setPersistedSelectedArticleId: (articleId: string | undefined) => void) {
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
        if (!current || !session || current.currentRevision.content === session.content && session.draftVersion === undefined)
            return undefined;

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


function useArticleRevisions(client: EditorialWorkspaceClient, article: Article | undefined, updateRevision: (articleId: string, revision: ArticleRevision) => void, saveDraft: (articleId: string) => Promise<unknown>, discardDraft: (articleId: string) => Promise<void>) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [revisions, setRevisions] = useState<ArticleRevision[]>([]);
    const [candidate, setCandidate] = useState<ArticleRevision>();
    const articleId = article?.id;
    const currentRevisionId = article?.currentRevisionId;

    useEffect(() => {
        if (!articleId) {
            setRevisions([]);
            return;
        }

        client.listArticleRevisions(articleId).then(setRevisions).catch((error) => notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.revisionHistoryFailed" }) }));
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
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }

    return { revisions, candidate, setCandidate, restore };
}


function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ReturnType<typeof useArticleWorkspace>) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [proposal, setProposal] = useState("");
    const [base, setBase] = useState<{ articleId: string; content: string; revisionId: string }>();
    const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const [factCheckResult, setFactCheckResult] = useState<EditorialResult<FactCheck>>();
    const [styleReviewResult, setStyleReviewResult] = useState<EditorialResult<StyleReview>>();
    const [translationResult, setTranslationResult] = useState<EditorialResult<{ metadata: TranslationMetadata; content: string }>>();
    const controller = useRef<AbortController>();
    const review = useMemo(() => base && base.articleId === workspace.selectedArticle?.id ? createTextProposal(base.content, proposal) : undefined, [base, proposal, workspace.selectedArticle?.id]);
    const stale = Boolean(workspace.selectedArticle && base?.articleId === workspace.selectedArticle.id && base.revisionId !== workspace.selectedArticle.currentRevisionId);
    const selectedArticleId = workspace.selectedArticle?.id;
    const factCheck = factCheckResult?.articleId === selectedArticleId ? factCheckResult?.value : undefined;
    const styleReview = styleReviewResult?.articleId === selectedArticleId ? styleReviewResult?.value : undefined;
    const translation = translationResult?.articleId === selectedArticleId ? translationResult?.value.metadata : undefined;
    const factCheckStale = factCheckResult?.articleId === selectedArticleId && factCheckResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const styleReviewStale = styleReviewResult?.articleId === selectedArticleId && styleReviewResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;
    const translationStale = translationResult?.articleId === selectedArticleId && translationResult?.baseRevisionId !== workspace.selectedArticle?.currentRevisionId;


    async function request(operation: EditorialOperation, authorContext: string, targetLanguage?: string) {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        try {
            const saved = await workspace.save(article.id);
            const revisionId = saved?.id ?? article.currentRevisionId;
            const content = saved?.content ?? workspace.content;

            if (operation === "thesis_to_narrative" || operation === "flow_revision") {
                setBase({ articleId: article.id, content, revisionId });
                setProposal("");
                setSelectedChanges(new Set());
            }

            setMessage("");
            setState("streaming");

            controller.current = new AbortController();

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}) }, (event: EditorialEvent) => {
                if (event.type === "text_delta" && (operation === "thesis_to_narrative" || operation === "flow_revision"))
                    setProposal((value) => value + event.delta);

                if (event.type === "completed") {
                    if (operation === "thesis_to_narrative" || operation === "flow_revision")
                        setProposal(event.text);

                    if (event.factCheck)
                        setFactCheckResult({ articleId: article.id, baseRevisionId: revisionId, value: event.factCheck });

                    if (event.styleReview)
                        setStyleReviewResult({ articleId: article.id, baseRevisionId: revisionId, value: event.styleReview });

                    if (event.translation)
                        setTranslationResult({ articleId: article.id, baseRevisionId: revisionId, value: { metadata: event.translation, content: event.text } });

                    setState("idle");
                }

                if (event.type === "error") {
                    setState("error");
                    setMessage(intl.formatMessage({ id: errorMessageId(event.errorCode) }, event.parameters));
                }
            }, controller.current.signal);
        } catch (error) {
            if ((error as DOMException).name !== "AbortError") {
                setState("error");
                if (error instanceof ApplicationClientError)
                    setMessage(intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters));
                else
                    setMessage(intl.formatMessage({ id: "errors.editorialRequestFailed" }));
            }
        }
    }


    async function accept() {
        const article = workspace.selectedArticle;
        if (!article || !base || !review || stale)
            return;

        const content = applyProposalChanges(review, selectedChanges);
        try {
            const revision = await client.acceptProposal(article.id, { baseRevisionId: base.revisionId, content, provenance: { kind: "accepted-proposal" } });

            workspace.updateRevision(article.id, revision);
            workspace.setContent(content);
            setProposal("");
            setBase(undefined);
            setSelectedChanges(new Set());
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function createTranslation() {
        const article = workspace.selectedArticle;
        if (!article || !translationResult || translationResult.articleId !== article.id || translationStale)
            return;

        const translation = translationResult.value.metadata;

        try {
            const configuredDefaultProfile = await client.getPublishLimitProfile();
            await workspace.create({
                title: `${article.title} — ${translation.targetLanguage}`,
                content: translationResult.value.content,
                language: targetLanguageId(translationResult.value.metadata.targetLanguage),
                publishingProfileId: isPublishLimitProfileId(article.publishingProfileId)
                    ? article.publishingProfileId
                    : isPublishLimitProfileId(configuredDefaultProfile)
                        ? configuredDefaultProfile
                        : defaultPublishLimitProfileId,
                sourceArticleId: article.id,
                sourceRevisionId: translationResult.baseRevisionId
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }

    function applyAssistantResult(articleId: string, baseRevisionId: string, result: AssistantEditorialResult) {
        const article = workspace.articles.find((item) => item.id === articleId);
        if (!article)
            return;

        if (result.proposal) {
            setBase({ articleId, content: article.currentRevision.content, revisionId: baseRevisionId });
            setProposal(result.proposal);
            setSelectedChanges(new Set());
        }

        if (result.factCheck)
            setFactCheckResult({ articleId, baseRevisionId, value: result.factCheck });

        if (result.styleReview)
            setStyleReviewResult({ articleId, baseRevisionId, value: result.styleReview });

        if (result.translation)
            setTranslationResult({ articleId, baseRevisionId, value: result.translation });
    }

    return {
        proposal,
        review,
        base,
        stale,
        proposalStale: stale,
        selectedChanges,
        setSelectedChanges,
        state,
        message,
        factCheck,
        factCheckStale,
        styleReview,
        styleReviewStale,
        translation,
        translationStale,
        request,
        accept,
        reject: () => {
            setProposal("");
            setBase(undefined);
        },
        cancel: () => controller.current?.abort(),
        createTranslation,
        applyAssistantResult
    };
}


function targetLanguageId(language: string): string {
    return ({ English: "en", Spanish: "es", Portuguese: "pt", Russian: "ru", French: "fr", German: "de", Italian: "it" } as Record<string, string>)[language] ?? "en";
}


function providerLanguageName(languageId: string): string {
    return ({ en: "English", es: "Spanish", pt: "Portuguese", ru: "Russian", fr: "French", de: "German", it: "Italian" } as Record<string, string>)[languageId] ?? languageId;
}


function useStyleCorpus(client: EditorialWorkspaceClient) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [corpus, setCorpus] = useState<StyleCorpus>();

    useEffect(() => {
        client.getStyleCorpus().then(setCorpus).catch((error) => notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }));
    }, [client, intl, notifyError]);

    return {
        corpus,
        add: async (name: string, content: string) => {
            try {
                setCorpus(await client.addStyleCorpusItem({ name, content }));
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                await client.removeStyleCorpusItem(id);
                setCorpus(await client.getStyleCorpus());
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        }
    };
}


function useAssistantMessages(client: EditorialWorkspaceClient, workspace: ReturnType<typeof useArticleWorkspace>, selection: string | undefined, onResult: (articleId: string, baseRevisionId: string, result: AssistantEditorialResult) => void) {
    const intl = useIntl();
    const [messagesByArticle, setMessagesByArticle] = useState<Record<string, AssistantMessage[]>>({});
    const [stateByArticle, setStateByArticle] = useState<Record<string, ProposalState>>({});
    const [messageByArticle, setMessageByArticle] = useState<Record<string, string>>({});
    const [errorDetailsByArticle, setErrorDetailsByArticle] = useState<Record<string, string>>({});
    const controller = useRef<AbortController>();
    const article = workspace.selectedArticle;
    const messages = article ? messagesByArticle[article.id] : undefined;
    const state = article ? stateByArticle[article.id] ?? "idle" : "idle";
    const message = article ? messageByArticle[article.id] ?? "" : "";
    const errorDetails = article ? errorDetailsByArticle[article.id] : undefined;

    const reload = useCallback(async (articleId: string | undefined = article?.id) => {
        if (!articleId)
            return;

        const items = await client.listAssistantMessages(articleId);
        setMessagesByArticle((current) => ({
            ...current,
            [articleId]: items,
        }));
    }, [article, client]);

    useEffect(() => {
        let cancelled = false;
        if (!article)
            return () => {
                cancelled = true;
            };

        void client.listAssistantMessages(article.id)
            .then((items) => {
                if (!cancelled)
                    setMessagesByArticle((current) => ({
                        ...current,
                        [article.id]: items,
                    }));
            })
            .catch(() => {
                if (!cancelled)
                    setMessagesByArticle((current) => {
                        const remaining = { ...current };
                        delete remaining[article.id];

                        return remaining;
                    });
            });

        return () => {
            cancelled = true;
        };
    }, [article, client]);

    const request = useCallback(async (authorMessage: string, explicitSkillId?: BuiltInSkillId, targetLanguage?: string, skillOffset?: number) => {
        const current = workspace.selectedArticle;
        if (!current)
            return;

        try {
            const saved = await workspace.save(current.id);
            const revision = saved ?? current.currentRevision;
            setMessageByArticle((messages) => {
                const next = { ...messages };
                delete next[current.id];

                return next;
            });
            setErrorDetailsByArticle((details) => {
                const next = { ...details };
                delete next[current.id];

                return next;
            });
            setStateByArticle((states) => ({
                ...states,
                [current.id]: "streaming",
            }));
            controller.current = new AbortController();
            const streamedId = `streaming-${crypto.randomUUID()}`;
            const selectedContent = selection && workspace.content.includes(selection) ? selection : undefined;
            const selectionStart = selectedContent ? workspace.content.indexOf(selectedContent) : -1;
            await client.streamAssistantRequest(current.id, {
                requestId: crypto.randomUUID(),
                authorMessage,
                scope: selectedContent && selectionStart >= 0
                    ? { kind: "selection", baseRevisionId: revision.id, startOffset: selectionStart, endOffset: selectionStart + selectedContent.length }
                    : { kind: "article", baseRevisionId: revision.id },
                ...(explicitSkillId ? { explicitSkillId } : {}),
                ...(skillOffset === undefined ? {} : { skillOffset }),
                ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}),
            }, (event) => {
                if (event.type === "completed" && event.result)
                    onResult(current.id, revision.id, event.result);

                if (event.type !== "text_delta")
                    return;

                setMessagesByArticle((itemsByArticle) => {
                    const items = itemsByArticle[current.id];
                    const streamed = items?.find((item) => item.id === streamedId);
                    const next = {
                        id: streamedId,
                        articleId: current.id,
                        role: "assistant" as const,
                        kind: "response" as const,
                        status: "pending" as const,
                        content: `${streamed?.content ?? ""}${event.delta}`,
                        createdAt: streamed?.createdAt ?? new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };

                    return {
                        ...itemsByArticle,
                        [current.id]: [...(items ?? []).filter((item) => item.id !== streamedId), next],
                    };
                });
            }, controller.current.signal);
            await reload(current.id);
            setStateByArticle((states) => ({
                ...states,
                [current.id]: "idle",
            }));
        } catch (error) {
            if ((error as DOMException).name === "AbortError") {
                await reload(current.id).catch(() => undefined);
                setStateByArticle((states) => ({
                    ...states,
                    [current.id]: "idle",
                }));

                return;
            }

            setStateByArticle((states) => ({
                ...states,
                [current.id]: "error",
            }));
            setMessageByArticle((messages) => ({
                ...messages,
                [current.id]: intl.formatMessage({ id: "assistant.requestStartFailed" }),
            }));
            setErrorDetailsByArticle((details) => ({
                ...details,
                [current.id]: error instanceof ApplicationClientError
                    ? intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters)
                    : intl.formatMessage({ id: "errors.editorialRequestFailed" }),
            }));

            await reload(current.id).catch(() => undefined);
        }
    }, [client, intl, onResult, reload, selection, workspace]);

    return { messages, state, message, errorDetails, request, cancel: () => controller.current?.abort() };
}


function usePublishing(client: EditorialWorkspaceClient, article: Article | undefined, content: string, updateArticle: (articleId: string, input: import("@skladno/shared").UpdateArticleInput) => Promise<void>) {
    const intl = useIntl();
    const { notify } = useNotifications();
    const [defaultProfileId, setDefaultProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);

    useEffect(() => {
        client.getPublishLimitProfile()
            .then((profileId) => setDefaultProfileId(isPublishLimitProfileId(profileId) ? profileId : defaultPublishLimitProfileId))
            .catch(() => notify({ tone: "info", title: intl.formatMessage({ id: "publishing.defaultProfile" }) }));
    }, [client, intl, notify]);

    const text = preparePlainTextForPublishing(content);
    const profileId = isPublishLimitProfileId(article?.publishingProfileId) ? article.publishingProfileId : defaultProfileId;
    const profile = getPublishLimitProfile(profileId);

    return {
        text,
        profileId,
        profile,
        length: getPublishingLength(text, profile),
        setProfile: async (id: typeof profileId) => {
            if (!article)
                return;

            try {
                await updateArticle(article.id, { publishingProfileId: id });
            } catch (error) {
                notify({ tone: "error", title: intl.formatMessage({ id: "publishing.profileSaveFailed" }) });
                throw error;
            }
        },
        copy: async () => {
            try {
                await navigator.clipboard.writeText(text);
                notify({ tone: "success", title: intl.formatMessage({ id: "publishing.copied" }) });
            } catch {
                notify({ tone: "error", title: intl.formatMessage({ id: "publishing.copyFailed" }) });
            }
        }
    };
}


function useWorkspaceLayout() {
    const [preferences, setPreferences] = useState(() => {
        const stored = localStorage.getItem("skladno-workspace-layout");

        if (stored)
            try {
                const parsed = JSON.parse(stored) as { version?: number; libraryWidth?: number; assistantWidth?: number; libraryCollapsed?: boolean; assistantCollapsed?: boolean; selectedArticleId?: unknown; view?: unknown };

                if (parsed.version === 2 && isWorkspaceView(parsed.view))
                    return {
                        version: 2,
                        libraryWidth: Math.min(280, Math.max(192, parsed.libraryWidth ?? 208)),
                        assistantWidth: Math.max(320, parsed.assistantWidth ?? 384),
                        libraryCollapsed: parsed.libraryCollapsed ?? false,
                        assistantCollapsed: parsed.assistantCollapsed ?? false,
                        view: parsed.view,
                        ...(typeof parsed.selectedArticleId === "string" && parsed.selectedArticleId.trim() ? { selectedArticleId: parsed.selectedArticleId } : {}),
                    };

                if (parsed.version === 1)
                    return {
                        version: 2,
                        libraryWidth: Math.min(280, Math.max(192, parsed.libraryWidth ?? 208)),
                        assistantWidth: Math.max(320, parsed.assistantWidth ?? 384),
                        libraryCollapsed: parsed.libraryCollapsed ?? false,
                        assistantCollapsed: parsed.assistantCollapsed ?? false,
                        view: "write" as const,
                    };
            } catch {
                // Replace malformed local preferences with the current version.
            }

        const migrated = { version: 2, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: localStorage.getItem("skladno-navigation-collapsed") === "true", assistantCollapsed: localStorage.getItem("skladno-assistant-collapsed") === "true", view: "write" as const };

        localStorage.setItem("skladno-workspace-layout", JSON.stringify(migrated));
        localStorage.removeItem("skladno-navigation-collapsed");
        localStorage.removeItem("skladno-assistant-collapsed");

        return migrated;
    });
    const [focusMode, setFocusMode] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState("es");

    const setView = useCallback((view: WorkspaceView) => setPreferences((current) => ({ ...current, view })), []);
    const setSelectedArticleId = useCallback((selectedArticleId: string | undefined) => setPreferences((current) => ({ ...current, ...(selectedArticleId ? { selectedArticleId } : { selectedArticleId: undefined }) })), []);

    useEffect(() => localStorage.setItem("skladno-workspace-layout", JSON.stringify(preferences)), [preferences]);

    return {
        view: preferences.view,
        setView,
        selectedArticleId: preferences.selectedArticleId,
        setSelectedArticleId,
        libraryCollapsed: preferences.libraryCollapsed,
        setLibraryCollapsed: (libraryCollapsed: boolean) => setPreferences((current) => ({ ...current, libraryCollapsed })),
        assistantCollapsed: preferences.assistantCollapsed,
        setAssistantCollapsed: (assistantCollapsed: boolean) => setPreferences((current) => ({ ...current, assistantCollapsed })),
        libraryWidth: preferences.libraryWidth,
        setLibraryWidth: (libraryWidth: number) => setPreferences((current) => ({ ...current, libraryWidth: Math.min(280, Math.max(192, libraryWidth)) })),
        assistantWidth: preferences.assistantWidth,
        setAssistantWidth: (assistantWidth: number) => setPreferences((current) => ({ ...current, assistantWidth: Math.max(320, assistantWidth) })),
        focusMode,
        setFocusMode,
        targetLanguage,
        setTargetLanguage
    };
}


function useWorkspaceGeneralSettings(client: EditorialWorkspaceClient, screen: "editorial-workspace" | "application-settings") {
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings);

    useEffect(() => {
        if (screen !== "editorial-workspace")
            return;

        void client.getApplicationSettings()
            .then((settings) => setGeneralSettings(settings.general))
            .catch(() => undefined);
    }, [client, screen]);

    return generalSettings;
}


export type ArticleWorkspaceState = ReturnType<typeof useArticleWorkspace>;
export type ArticleRevisionsState = ReturnType<typeof useArticleRevisions>;
export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
export type StyleCorpusState = ReturnType<typeof useStyleCorpus>;
export type PublishingState = ReturnType<typeof usePublishing>;
export type WorkspaceLayoutState = ReturnType<typeof useWorkspaceLayout>;


export function EditorialWorkspaceProvider({ client, screen, openSettings, backToWorkspace, dispatcher, keyBindingOverrides, onKeyBindingsUpdated }: { client: EditorialWorkspaceClient; screen: "editorial-workspace" | "application-settings"; openSettings: () => void; backToWorkspace: () => void; dispatcher: KeyBindingDispatcher; keyBindingOverrides: KeyBindingOverrides; onKeyBindingsUpdated: (overrides: KeyBindingOverrides) => void }) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const layout = useWorkspaceLayout();
    const workspace = useArticleWorkspace(client, layout.selectedArticleId, layout.setSelectedArticleId);
    const generalSettings = useWorkspaceGeneralSettings(client, screen);
    const revisions = useArticleRevisions(client, workspace.selectedArticle, workspace.updateRevision, workspace.save, workspace.discardDraft);
    const editorial = useEditorialProposal(client, workspace);
    const corpus = useStyleCorpus(client);
    const [assistantSelection, setAssistantSelection] = useState<string>();
    const assistant = useAssistantMessages(client, workspace, assistantSelection, editorial.applyAssistantResult);
    const publishing = usePublishing(client, workspace.selectedArticle, workspace.content, workspace.updateArticle);

    const createBlank = useCallback(async () => {
        try {
            const settings = await client.getApplicationSettings();
            const defaultLanguage = settings.general.defaultArticleLanguage;
            const defaultProfileId = await client.getPublishLimitProfile();
            return await workspace.create({
                title: intl.formatMessage({ id: "article.defaultTitle" }),
                content: "",
                language: isArticleLanguage(defaultLanguage) ? defaultLanguage : "en",
                publishingProfileId: isPublishLimitProfileId(defaultProfileId) ? defaultProfileId : defaultPublishLimitProfileId,
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }, [client, intl, notifyError, workspace]);

    const enterSettings = useCallback(() => {
        void workspace.flushSelected().catch(() => undefined);
        openSettings();
    }, [openSettings, workspace]);

    const shortcutActions = useRef({
        createBlank,
        save: workspace.save,
        enterSettings,
        setFocusMode: layout.setFocusMode,
        libraryCollapsed: layout.libraryCollapsed,
        setLibraryCollapsed: layout.setLibraryCollapsed,
        assistantCollapsed: layout.assistantCollapsed,
        setAssistantCollapsed: layout.setAssistantCollapsed,
        setView: layout.setView,
    });
    shortcutActions.current = {
        createBlank,
        save: workspace.save,
        enterSettings,
        setFocusMode: layout.setFocusMode,
        libraryCollapsed: layout.libraryCollapsed,
        setLibraryCollapsed: layout.setLibraryCollapsed,
        assistantCollapsed: layout.assistantCollapsed,
        setAssistantCollapsed: layout.setAssistantCollapsed,
        setView: layout.setView,
    };

    useLayoutEffect(() => {
        if (screen !== "editorial-workspace")
            return;

        function toggleFocusMode() {
            const activeElement = document.activeElement;
            const focusWillBeLost = !(activeElement instanceof HTMLElement)
                || activeElement === document.body
                || Boolean(activeElement.closest("[data-workspace-panel]"));

            if (focusWillBeLost)
                document.querySelector<HTMLElement>("[data-article-workspace]")?.focus({ preventScroll: true });

            shortcutActions.current.setFocusMode((current) => !current);
        }

        const unregister = [
            dispatcher.register(KEY_BINDING_COMMAND.NEW_ARTICLE, () => void shortcutActions.current.createBlank()),
            dispatcher.register(KEY_BINDING_COMMAND.SAVE_REVISION, () => void shortcutActions.current.save().catch(() => undefined)),
            dispatcher.register(KEY_BINDING_COMMAND.OPEN_SETTINGS, () => shortcutActions.current.enterSettings()),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_FOCUS_MODE, toggleFocusMode),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_ARTICLE_LIBRARY, () => shortcutActions.current.setLibraryCollapsed(!shortcutActions.current.libraryCollapsed)),
            dispatcher.register(KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, () => shortcutActions.current.setAssistantCollapsed(!shortcutActions.current.assistantCollapsed)),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_WRITE, () => shortcutActions.current.setView("write")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_PROPOSAL, () => shortcutActions.current.setView("proposal")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_REVISIONS, () => shortcutActions.current.setView("revisions")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_FACT_CHECK, () => shortcutActions.current.setView("fact-check")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE, () => shortcutActions.current.setView("style-profile")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_TRANSLATIONS, () => shortcutActions.current.setView("translations")),
            dispatcher.register(KEY_BINDING_COMMAND.VIEW_PUBLISH, () => shortcutActions.current.setView("publish")),
        ];

        return () => unregister.forEach((remove) => remove());
    }, [dispatcher, screen]);

    if (workspace.state === "loading")
        return <main className="grid min-h-screen place-items-center text-muted">
            {intl.formatMessage({ id: "workspace.loadingArticles" })}
        </main>;

    if (workspace.state === "error")
        return <main className="grid min-h-screen place-items-center">
            <Banner tone="error" role="alert">{workspace.message}</Banner>
        </main>;

    if (screen === "application-settings")
        return <ApplicationSettings client={client} back={backToWorkspace} onKeyBindingsUpdated={onKeyBindingsUpdated} />;

    return <ExtractedWorkspaceShell
        focusMode={layout.focusMode}
        libraryCollapsed={layout.libraryCollapsed}
        setLibraryCollapsed={layout.setLibraryCollapsed}
        assistantCollapsed={layout.assistantCollapsed}
        setAssistantCollapsed={layout.setAssistantCollapsed}
        libraryWidth={layout.libraryWidth}
        setLibraryWidth={layout.setLibraryWidth}
        assistantWidth={layout.assistantWidth}
        setAssistantWidth={layout.setAssistantWidth}
        library={<ExtractedArticleLibraryPanel
            articles={workspace.articles}
            selectedArticleId={workspace.selectedArticleId}
            selectArticle={workspace.selectArticle}
            collapsed={layout.libraryCollapsed}
            setCollapsed={layout.setLibraryCollapsed}
            createBlank={createBlank}
            openStyleProfile={() => layout.setView("style-profile")}
            openSettings={enterSettings}
            language={workspace.selectedArticle?.language}
            saveState={workspace.saveState}
            dispatcher={dispatcher}
            shortcutOverrides={keyBindingOverrides} />
        }
        assistant={<ExtractedEditorialAssistantPanel
            state={assistant.state}
            message={assistant.message}
            errorDetails={assistant.errorDetails}
            onRequest={assistant.request}
            onCancel={assistant.cancel}
            collapsed={layout.assistantCollapsed}
            setCollapsed={layout.setAssistantCollapsed}
            language={layout.targetLanguage}
            assistantMessages={assistant.messages}
            dispatcher={dispatcher}
            shortcutOverrides={keyBindingOverrides}
            selection={assistantSelection}
            openView={layout.setView}
            generalSettings={generalSettings}
            clearSelection={() => setAssistantSelection(undefined)} />
        }>
        <ExtractedArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} generalSettings={generalSettings} createBlank={createBlank} shortcutOverrides={keyBindingOverrides} onSelectionChange={setAssistantSelection} assistantSelection={assistantSelection} />
        <ExtractedRestoreRevisionDialog candidate={revisions.candidate} hasUncommittedChanges={workspace.hasUncommittedChanges} close={() => revisions.setCandidate(undefined)} restore={revisions.restore} />
        <DraftConflictDialog conflict={workspace.conflict} open={Boolean(workspace.comparisonArticleId)} close={workspace.closeComparison} resolve={workspace.resolveConflict} />
    </ExtractedWorkspaceShell>;
}
