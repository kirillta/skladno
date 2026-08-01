import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    createTextProposal,
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
    type PublishLimitProfileId,
    type StyleCorpus,
    type StyleReview,
    type TranslationMetadata,
    KEY_BINDING_COMMAND,
    type KeyBindingOverrides,
} from "@skladno/shared";
import { ApplicationClientError, ArticleDraftConflictError, ArticleRevisionConflictError, type ArticleDraft } from "@skladno/shared";
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

export type WorkspaceView = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "publish";
export type SaveState = "saved" | "unsaved" | "saving" | "draft-saved" | "error" | "conflict";
type ProposalState = "idle" | "streaming" | "error";
export interface DraftConflict {
    article: Article;
    draft?: ArticleDraft;
    localContent: string;
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



function useArticleWorkspace(client: EditorialWorkspaceClient) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string>();
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
    const [conflicts, setConflicts] = useState<Record<string, DraftConflict | undefined>>({});
    const [comparisonArticleId, setComparisonArticleId] = useState<string>();
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState(() => intl.formatMessage({ id: "workspace.loadingArticles" }));
    const articlesRef = useRef<Article[]>([]);
    const draftsRef = useRef<Record<string, string>>({});
    const revisions = useRef(new Map<string, string>());
    const versions = useRef(new Map<string, number>());
    const queues = useRef(new Map<string, Promise<void>>());
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const generations = useRef(new Map<string, number>());
    const checkpointRef = useRef<(articleId: string) => Promise<void>>(() => Promise.resolve());


    function replaceArticles(update: (items: Article[]) => Article[]) {
        setArticles((items) => {
            const next = update(items);
            articlesRef.current = next;

            return next;
        });
    }


    function replaceDraft(articleId: string, content: string) {
        draftsRef.current = { ...draftsRef.current, [articleId]: content };
        setDrafts(draftsRef.current);
    }


    function setSaveState(articleId: string, value: SaveState) {
        setSaveStates((items) => ({ ...items, [articleId]: value }));
    }


    useEffect(() => {
        client.listArticles().then((loaded) => {
            articlesRef.current = loaded;
            draftsRef.current = Object.fromEntries(loaded.map((article) => [article.id, articleContentForWorkspace(article)]));
            setArticles(loaded);
            setDrafts(draftsRef.current);
            setSaveStates(Object.fromEntries(loaded.map((article) => [article.id, article.draft ? "draft-saved" : "saved"])));
            revisions.current = new Map(loaded.map((article) => [article.id, article.currentRevisionId]));
            versions.current = new Map(loaded.flatMap((article) => article.draft ? [[article.id, article.draft.version]] : []));
            setSelectedArticleId(loaded[0]?.id);
            setState("ready");
        }).catch(() => {
            setState("error");
            setMessage(intl.formatMessage({ id: "workspace.serviceUnavailable" }));
        });
    }, [client, intl]);


    function recordConflict(articleId: string, error: ArticleDraftConflictError | ArticleRevisionConflictError, localContent: string) {
        const persistedDraft = error instanceof ArticleDraftConflictError ? error.draft : error.article.draft;
        setConflicts((items) => ({ ...items, [articleId]: { article: error.article, draft: persistedDraft, localContent } }));
        setSaveState(articleId, "conflict");
    }


    function checkpoint(articleId: string, content = draftsRef.current[articleId] ?? ""): Promise<void> {
        clearTimeout(timers.current.get(articleId));
        const generation = generations.current.get(articleId) ?? 0;
        const preceding = queues.current.get(articleId) ?? Promise.resolve();
        const task = preceding.then(async () => {
            const current = articlesRef.current.find((article) => article.id === articleId);
            const baseRevisionId = revisions.current.get(articleId);
            if (!current || !baseRevisionId)
                return;

            setSaveState(articleId, "saving");
            const expectedDraftVersion = versions.current.get(articleId);
            if (content === current.currentRevision.content) {
                if (expectedDraftVersion !== undefined) {
                    await client.discardArticleDraft(articleId, expectedDraftVersion);
                    versions.current.delete(articleId);
                    replaceArticles((items) => items.map((article) => article.id === articleId ? withoutDraft(article) : article));
                }

                if (generations.current.get(articleId) === generation)
                    setSaveState(articleId, "saved");

                return;
            }

            const savedDraft = await client.saveArticleDraft(articleId, {
                content,
                baseRevisionId,
                ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion }),
            });
            versions.current.set(articleId, savedDraft.version);
            replaceArticles((items) => items.map((article) => article.id === articleId ? { ...article, draft: savedDraft } : article));
            if (generations.current.get(articleId) === generation)
                setSaveState(articleId, "draft-saved");
        }).catch((error: unknown) => {
            if (error instanceof ArticleDraftConflictError || error instanceof ArticleRevisionConflictError)
                recordConflict(articleId, error, draftsRef.current[articleId] ?? content);
            else
                setSaveState(articleId, "error");

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
        revisions.current.set(articleId, revision.id);
        versions.current.delete(articleId);
        replaceDraft(articleId, revision.content);
        replaceArticles((items) => items.map((article) => article.id === articleId ? {
            ...withoutDraft(article),
            updatedAt: revision.createdAt,
            currentRevisionId: revision.id,
            currentRevision: revision,
        } : article));
        setSaveState(articleId, "saved");
    }


    async function save(articleId = selectedArticleId): Promise<ArticleRevision | undefined> {
        if (!articleId)
            return undefined;

        const content = draftsRef.current[articleId] ?? "";
        const current = articlesRef.current.find((article) => article.id === articleId);
        const baseRevisionId = revisions.current.get(articleId);
        if (!current || !baseRevisionId || current.currentRevision.content === content && versions.current.get(articleId) === undefined)
            return undefined;

        try {
            await checkpoint(articleId, content);
            const expectedDraftVersion = versions.current.get(articleId);
            if (expectedDraftVersion === undefined)
                return undefined;

            setSaveState(articleId, "saving");
            const revision = await client.saveArticleRevision(articleId, { content, baseRevisionId, expectedDraftVersion });
            updateRevision(articleId, revision);
            return revision;
        } catch (error) {
            if (!(error instanceof ArticleDraftConflictError) && !(error instanceof ArticleRevisionConflictError))
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.saveFailed" }) });

            throw error;
        }
    }


    async function resolveConflict(mode: "keep" | "draft" | "revision") {
        if (!comparisonArticleId)
            return;

        const conflict = conflicts[comparisonArticleId];
        if (!conflict)
            return;

        try {
            if (mode === "keep") {
                revisions.current.set(comparisonArticleId, conflict.article.currentRevisionId);
                if (conflict.draft)
                    versions.current.set(comparisonArticleId, conflict.draft.version);
                else
                    versions.current.delete(comparisonArticleId);

                await checkpoint(comparisonArticleId, conflict.localContent);
            } else if (mode === "draft" && conflict.draft) {
                revisions.current.set(comparisonArticleId, conflict.article.currentRevisionId);
                versions.current.set(comparisonArticleId, conflict.draft.version);
                replaceDraft(comparisonArticleId, conflict.draft.content);
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? conflict.article : article));
                setSaveState(comparisonArticleId, "draft-saved");
            } else if (mode === "revision") {
                if (conflict.draft)
                    await client.discardArticleDraft(comparisonArticleId, conflict.draft.version);

                revisions.current.set(comparisonArticleId, conflict.article.currentRevisionId);
                versions.current.delete(comparisonArticleId);
                replaceDraft(comparisonArticleId, conflict.article.currentRevision.content);
                replaceArticles((items) => items.map((article) => article.id === comparisonArticleId ? withoutDraft(conflict.article) : article));
                setSaveState(comparisonArticleId, "saved");
            }

            setConflicts((items) => ({ ...items, [comparisonArticleId]: undefined }));
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
        revisions.current.set(article.id, article.currentRevisionId);
        replaceArticles((items) => [article, ...items]);
        replaceDraft(article.id, article.currentRevision.content);
        setSaveState(article.id, "saved");
        setSelectedArticleId(article.id);
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
            if (selectedArticleId === articleId)
                setSelectedArticleId(next[0]?.id);

            return next;
        });
    }


    async function discardDraft(articleId = selectedArticleId) {
        if (!articleId)
            return;

        const expectedDraftVersion = versions.current.get(articleId);
        if (expectedDraftVersion !== undefined)
            await client.discardArticleDraft(articleId, expectedDraftVersion);

        versions.current.delete(articleId);
        const current = articlesRef.current.find((article) => article.id === articleId);
        if (current) {
            replaceDraft(articleId, current.currentRevision.content);
            replaceArticles((items) => items.map((article) => article.id === articleId ? withoutDraft(article) : article));
        }
    }


    const selectedArticle = articles.find((article) => article.id === selectedArticleId);
    const content = selectedArticleId ? drafts[selectedArticleId] ?? "" : "";
    return {
        articles,
        selectedArticle,
        selectedArticleId,
        selectArticle: (articleId: string) => {
            if (selectedArticleId && selectedArticleId !== articleId)
                void checkpoint(selectedArticleId).catch(() => undefined);

            setSelectedArticleId(articleId);
        },
        content,
        setContent: (value: string) => {
            if (!selectedArticleId)
                return;

            replaceDraft(selectedArticleId, value);
            generations.current.set(selectedArticleId, (generations.current.get(selectedArticleId) ?? 0) + 1);
            setSaveState(selectedArticleId, "unsaved");
            scheduleCheckpoint(selectedArticleId, value);
        },
        state,
        message,
        saveState: selectedArticleId ? saveStates[selectedArticleId] ?? "saved" : "saved",
        save,
        retry: () => selectedArticleId ? checkpoint(selectedArticleId) : Promise.resolve(),
        flushSelected: () => selectedArticleId ? checkpoint(selectedArticleId) : Promise.resolve(),
        discardDraft,
        hasUncommittedChanges: Boolean(selectedArticle && content !== selectedArticle.currentRevision.content),
        conflict: selectedArticleId ? conflicts[selectedArticleId] : undefined,
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
    const [base, setBase] = useState<{ content: string; revisionId: string }>();
    const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
    const [state, setState] = useState<ProposalState>("idle");
    const [message, setMessage] = useState("");
    const [factCheck, setFactCheck] = useState<FactCheck>();
    const [styleReview, setStyleReview] = useState<StyleReview>();
    const [translation, setTranslation] = useState<TranslationMetadata>();
    const controller = useRef<AbortController>();
    const review = useMemo(() => base ? createTextProposal(base.content, proposal) : undefined, [base, proposal]);
    const stale = Boolean(workspace.selectedArticle && base && base.revisionId !== workspace.selectedArticle.currentRevisionId);


    async function request(operation: EditorialOperation, authorContext: string, targetLanguage?: string) {
        const article = workspace.selectedArticle;
        if (!article)
            return;

        try {
            const saved = await workspace.save(article.id);
            const revisionId = saved?.id ?? article.currentRevisionId;
            const content = saved?.content ?? workspace.content;

            setBase({ content, revisionId });
            setProposal("");
            setSelectedChanges(new Set());
            setMessage("");
            setState("streaming");

            controller.current = new AbortController();

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}) }, (event: EditorialEvent) => {
                if (event.type === "text_delta")
                    setProposal((value) => value + event.delta);

                if (event.type === "completed") {
                    setProposal(event.text);
                    setFactCheck(event.factCheck);
                    setStyleReview(event.styleReview);
                    setTranslation(event.translation);
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
        if (!article || !translation || !base || stale)
            return;

        try {
            const configuredDefaultProfile = await client.getPublishLimitProfile();
            await workspace.create({
                title: `${article.title} — ${translation.targetLanguage}`,
                content: proposal,
                language: targetLanguageId(translation.targetLanguage),
                publishingProfileId: isPublishLimitProfileId(article.publishingProfileId)
                    ? article.publishingProfileId
                    : isPublishLimitProfileId(configuredDefaultProfile)
                        ? configuredDefaultProfile
                        : defaultPublishLimitProfileId,
                sourceArticleId: article.id,
                sourceRevisionId: base.revisionId
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }

    return {
        proposal,
        review,
        base,
        stale,
        selectedChanges,
        setSelectedChanges,
        state,
        message,
        factCheck,
        styleReview,
        translation,
        request,
        accept,
        reject: () => {
            setProposal("");
            setBase(undefined);
        },
        cancel: () => controller.current?.abort(),
        createTranslation
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
    const [view, setView] = useState<WorkspaceView>("write");
    const [preferences, setPreferences] = useState(() => {
        const stored = localStorage.getItem("skladno-workspace-layout");

        if (stored)
            try {
                const parsed = JSON.parse(stored) as { version?: number; libraryWidth?: number; assistantWidth?: number; libraryCollapsed?: boolean; assistantCollapsed?: boolean };

                if (parsed.version === 1)
                    return {
                        version: 1,
                        libraryWidth: Math.min(280, Math.max(192, parsed.libraryWidth ?? 208)),
                        assistantWidth: Math.max(320, parsed.assistantWidth ?? 384),
                        libraryCollapsed: parsed.libraryCollapsed ?? false,
                        assistantCollapsed: parsed.assistantCollapsed ?? false,
                    };
            } catch {
                // Replace malformed local preferences with the current version.
            }

        const migrated = { version: 1, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: localStorage.getItem("skladno-navigation-collapsed") === "true", assistantCollapsed: localStorage.getItem("skladno-assistant-collapsed") === "true" };

        localStorage.setItem("skladno-workspace-layout", JSON.stringify(migrated));
        localStorage.removeItem("skladno-navigation-collapsed");
        localStorage.removeItem("skladno-assistant-collapsed");

        return migrated;
    });
    const [focusMode, setFocusMode] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState("es");

    useEffect(() => localStorage.setItem("skladno-workspace-layout", JSON.stringify(preferences)), [preferences]);

    return {
        view,
        setView,
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


export type ArticleWorkspaceState = ReturnType<typeof useArticleWorkspace>;
export type ArticleRevisionsState = ReturnType<typeof useArticleRevisions>;
export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
export type StyleCorpusState = ReturnType<typeof useStyleCorpus>;
export type PublishingState = ReturnType<typeof usePublishing>;
export type WorkspaceLayoutState = ReturnType<typeof useWorkspaceLayout>;


export function EditorialWorkspaceProvider({ client, screen, openSettings, backToWorkspace, dispatcher, keyBindingOverrides, onKeyBindingsUpdated }: { client: EditorialWorkspaceClient; screen: "editorial-workspace" | "application-settings"; openSettings: () => void; backToWorkspace: () => void; dispatcher: KeyBindingDispatcher; keyBindingOverrides: KeyBindingOverrides; onKeyBindingsUpdated: (overrides: KeyBindingOverrides) => void }) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const workspace = useArticleWorkspace(client);
    const layout = useWorkspaceLayout();
    const revisions = useArticleRevisions(client, workspace.selectedArticle, workspace.updateRevision, workspace.save, workspace.discardDraft);
    const editorial = useEditorialProposal(client, workspace);
    const corpus = useStyleCorpus(client);
    const publishing = usePublishing(client, workspace.selectedArticle, workspace.content, workspace.updateArticle);

    const createBlank = useCallback(async () => {
        try {
            const settings = await client.getApplicationSettings();
            const defaultLanguage = settings.general.defaultArticleLanguage;
            const defaultProfileId = await client.getPublishLimitProfile();
            return await workspace.create({
                title: "Untitled article",
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
                || Boolean(activeElement.closest('[aria-label="Article Library Panel"], [aria-label="Editorial Assistant Panel"]'));

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
            Loading your Article Library…
        </main>;

    if (workspace.state === "error")
        return <main className="grid min-h-screen place-items-center">
            <Banner tone="error" role="alert">{workspace.message}</Banner>
        </main>;

    if (screen === "application-settings")
        return <ApplicationSettings client={client} back={backToWorkspace} onKeyBindingsUpdated={onKeyBindingsUpdated} />;

    return <ExtractedWorkspaceShell focusMode={layout.focusMode} libraryCollapsed={layout.libraryCollapsed} setLibraryCollapsed={layout.setLibraryCollapsed} assistantCollapsed={layout.assistantCollapsed} setAssistantCollapsed={layout.setAssistantCollapsed} libraryWidth={layout.libraryWidth} setLibraryWidth={layout.setLibraryWidth} assistantWidth={layout.assistantWidth} setAssistantWidth={layout.setAssistantWidth} library={<ExtractedArticleLibraryPanel articles={workspace.articles} selectedArticleId={workspace.selectedArticleId} selectArticle={workspace.selectArticle} collapsed={layout.libraryCollapsed} setCollapsed={layout.setLibraryCollapsed} createBlank={createBlank} openStyleProfile={() => layout.setView("style-profile")} openSettings={enterSettings} language={workspace.selectedArticle?.language} saveState={workspace.saveState} dispatcher={dispatcher} shortcutOverrides={keyBindingOverrides} />} assistant={<ExtractedEditorialAssistantPanel state={editorial.state} message={editorial.message} onRequest={editorial.request} onCancel={editorial.cancel} collapsed={layout.assistantCollapsed} setCollapsed={layout.setAssistantCollapsed} language={layout.targetLanguage} dispatcher={dispatcher} shortcutOverrides={keyBindingOverrides} />}>
        <ExtractedArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} createBlank={createBlank} shortcutOverrides={keyBindingOverrides} />
        <ExtractedRestoreRevisionDialog candidate={revisions.candidate} hasUncommittedChanges={workspace.hasUncommittedChanges} close={() => revisions.setCandidate(undefined)} restore={revisions.restore} />
        <DraftConflictDialog conflict={workspace.conflict} open={Boolean(workspace.comparisonArticleId)} close={workspace.closeComparison} resolve={workspace.resolveConflict} />
    </ExtractedWorkspaceShell>;
}
