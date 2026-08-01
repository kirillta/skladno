import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
    applyProposalChanges,
    countPublishingCharacters,
    createTextProposal,
    defaultPublishLimitProfileId,
    getPublishLimitProfile,
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
} from "@skladno/shared";
import { ApplicationClientError } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Banner } from "../ui/primitives.js";
import { EditorialAssistantPanel as ExtractedEditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleLibraryPanel as ExtractedArticleLibraryPanel } from "./components/ArticleLibraryPanel.js";
import { ArticleWorkspace as ExtractedArticleWorkspace } from "./components/ArticleWorkspace.js";
import { RestoreRevisionDialog as ExtractedRestoreRevisionDialog } from "./components/RestoreRevisionDialog.js";
import { WorkspaceShell as ExtractedWorkspaceShell } from "./components/WorkspaceShell.js";
import { ApplicationSettings } from "../settings/ApplicationSettings.js";
import { errorMessageId } from "../i18n/errors.js";
import { useNotifications } from "../notifications/NotificationProvider.js";

export type WorkspaceView = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "publish";
type SaveState = "saved" | "saving" | "error";
type ProposalState = "idle" | "streaming" | "error";


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
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState(() => intl.formatMessage({ id: "workspace.loadingArticles" }));
    const [saveState, setSaveState] = useState<SaveState>("saved");
    const revisions = useRef(new Map<string, string>());
    const draftVersions = useRef(new Map<string, number>());
    const saveQueue = useRef(Promise.resolve());


    useEffect(() => {
        client.listArticles().then((loaded) => {
            setArticles(loaded);
            setDrafts(Object.fromEntries(loaded.map((article) => [article.id, articleContentForWorkspace(article)])));
            revisions.current = new Map(loaded.map((article) => [article.id, article.currentRevisionId]));
            draftVersions.current = new Map(loaded.flatMap((article) => article.draft ? [[article.id, article.draft.version]] : []));
            setSelectedArticleId(loaded[0]?.id);
            setState("ready");
        }).catch(() => {
            setState("error");
            setMessage(intl.formatMessage({ id: "workspace.serviceUnavailable" }));
        });
    }, [client, intl]);


    const selectedArticle = articles.find((article) => article.id === selectedArticleId);
    const content = selectedArticleId ? drafts[selectedArticleId] ?? "" : "";


    function updateRevision(articleId: string, revision: ArticleRevision) {
        revisions.current.set(articleId, revision.id);
        draftVersions.current.delete(articleId);
        setDrafts((items) => ({ ...items, [articleId]: revision.content }));
        setArticles((items) => items.map((article) => article.id === articleId ? {
            ...withoutDraft(article),
            updatedAt: revision.createdAt,
            currentRevisionId: revision.id,
            currentRevision: revision,
        } : article));
    }


    function checkpoint(articleId: string, content: string): Promise<void> {
        const task = saveQueue.current.then(async () => {
            const current = articles.find((article) => article.id === articleId);
            const baseRevisionId = revisions.current.get(articleId);
            if (!current || !baseRevisionId)
                return;

            const expectedDraftVersion = draftVersions.current.get(articleId);
            if (content === current.currentRevision.content) {
                if (expectedDraftVersion !== undefined) {
                    await client.discardArticleDraft(articleId, expectedDraftVersion);
                    draftVersions.current.delete(articleId);
                    setArticles((items) => items.map((article) => {
                        if (article.id !== articleId)
                            return article;

                        return withoutDraft(article);
                    }));
                }

                return;
            }

            const savedDraft = await client.saveArticleDraft(articleId, {
                content,
                baseRevisionId,
                ...(expectedDraftVersion === undefined ? {} : { expectedDraftVersion }),
            });
            draftVersions.current.set(articleId, savedDraft.version);
            setArticles((items) => items.map((article) => article.id === articleId ? {
                ...article,
                draft: savedDraft,
            } : article));
        });
        saveQueue.current = task.then(() => undefined, () => undefined);

        return task;
    }


    async function save(articleId = selectedArticleId): Promise<ArticleRevision | undefined> {
        if (!articleId)
            return undefined;

        const draft = drafts[articleId] ?? "";
        const current = articles.find((article) => article.id === articleId);
        const baseRevisionId = revisions.current.get(articleId);
        if (!current || !baseRevisionId || current.currentRevision.content === draft && draftVersions.current.get(articleId) === undefined)
            return undefined;

        setSaveState("saving");
        const task = saveQueue.current.then(async () => {
            const expectedDraftVersion = draftVersions.current.get(articleId);
            if (expectedDraftVersion === undefined)
                return undefined;

            const revision = await client.saveArticleRevision(articleId, { content: draft, baseRevisionId, expectedDraftVersion });
            updateRevision(articleId, revision);
            setSaveState("saved");
            return revision;
        });
        saveQueue.current = task.then(() => undefined, () => undefined);

        try {
            return await task;
        } catch (error) {
            setSaveState("error");
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.saveFailed" }) });
            throw error;
        }
    }


    async function create(input: { title: string; content: string; language?: string; audience?: string; sourceArticleId?: string; sourceRevisionId?: string }) {
        const article = await client.createArticle(input);
        revisions.current.set(article.id, article.currentRevisionId);
        setArticles((items) => [article, ...items]);
        setDrafts((items) => ({ ...items, [article.id]: article.currentRevision.content }));
        setSelectedArticleId(article.id);

        return article;
    }


    async function updateArticle(articleId: string, input: import("@skladno/shared").UpdateArticleInput) {
        const article = await client.updateArticle(articleId, input);
        setArticles((items) => items.map((item) => item.id === articleId ? article : item));
    }


    async function remove(articleId: string) {
        await client.deleteArticle(articleId);
        setArticles((items) => {
            const next = items.filter((item) => item.id !== articleId);
            if (selectedArticleId === articleId)
                setSelectedArticleId(next[0]?.id);

            return next;
        });
    }


    async function discardDraft(articleId = selectedArticleId): Promise<void> {
        if (!articleId)
            return;

        const task = saveQueue.current.then(async () => {
            const expectedDraftVersion = draftVersions.current.get(articleId);
            if (expectedDraftVersion !== undefined)
                await client.discardArticleDraft(articleId, expectedDraftVersion);

            draftVersions.current.delete(articleId);
            setArticles((items) => items.map((article) => article.id === articleId ? withoutDraft(article) : article));
            setDrafts((items) => {
                const current = articles.find((article) => article.id === articleId);
                return current ? { ...items, [articleId]: current.currentRevision.content } : items;
            });
        });
        saveQueue.current = task.then(() => undefined, () => undefined);

        await task;
    }

    return {
        articles,
        selectedArticle,
        selectedArticleId,
        setSelectedArticleId,
        content,
        setContent: (value: string) => {
            if (!selectedArticleId)
                return;

            setDrafts((items) => ({ ...items, [selectedArticleId]: value }));
            void checkpoint(selectedArticleId, value).catch((error) => {
                setSaveState("error");
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "workspace.saveFailed" }) });
            });
        },
        state,
        message,
        saveState,
        save,
        discardDraft,
        hasUncommittedChanges: Boolean(selectedArticle && content !== selectedArticle.currentRevision.content),
        create,
        updateArticle,
        remove,
        updateRevision
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

            await client.streamEditorial(article.id, { requestId: crypto.randomUUID(), operation, authorContext, ...(targetLanguage ? { targetLanguage } : {}) }, (event: EditorialEvent) => {
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
            await workspace.create({
                title: `${article.title} — ${translation.targetLanguage}`,
                content: proposal,
                language: targetLanguageId(translation.targetLanguage),
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


function usePublishing(client: EditorialWorkspaceClient, content: string) {
    const intl = useIntl();
    const { notify } = useNotifications();
    const [profileId, setProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);

    useEffect(() => {
        client.getPublishLimitProfile()
            .then(setProfileId)
            .catch(() => notify({ tone: "info", title: intl.formatMessage({ id: "publishing.defaultProfile" }) }));
    }, [client, intl, notify]);

    const text = preparePlainTextForPublishing(content);

    return {
        text,
        count: countPublishingCharacters(text),
        profileId,
        profile: getPublishLimitProfile(profileId),
        setProfile: async (id: PublishLimitProfileId) => {
            try {
                setProfileId(await client.setPublishLimitProfile(id));
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
    const [targetLanguage, setTargetLanguage] = useState("Spanish");

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


export function EditorialWorkspaceProvider({ client, screen, openSettings, backToWorkspace }: { client: EditorialWorkspaceClient; screen: "editorial-workspace" | "application-settings"; openSettings: () => void; backToWorkspace: () => void }) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const workspace = useArticleWorkspace(client);
    const layout = useWorkspaceLayout();
    const revisions = useArticleRevisions(client, workspace.selectedArticle, workspace.updateRevision, workspace.save, workspace.discardDraft);
    const editorial = useEditorialProposal(client, workspace);
    const corpus = useStyleCorpus(client);
    const publishing = usePublishing(client, workspace.content);

    async function createBlank() {
        try {
            const settings = await client.getApplicationSettings();
            const defaultLanguage = settings.general.defaultArticleLanguage;
            return await workspace.create({
                title: "Untitled article",
                content: "",
                language: isArticleLanguage(defaultLanguage) ? defaultLanguage : "en",
            });
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }

    if (workspace.state === "loading")
        return <main className="grid min-h-screen place-items-center text-muted">
            Loading your Article Library…
        </main>;

    if (workspace.state === "error")
        return <main className="grid min-h-screen place-items-center">
            <Banner tone="error" role="alert">{workspace.message}</Banner>
        </main>;

    if (screen === "application-settings")
        return <ApplicationSettings client={client} back={backToWorkspace} />;

    return <ExtractedWorkspaceShell focusMode={layout.focusMode} libraryCollapsed={layout.libraryCollapsed} setLibraryCollapsed={layout.setLibraryCollapsed} assistantCollapsed={layout.assistantCollapsed} setAssistantCollapsed={layout.setAssistantCollapsed} libraryWidth={layout.libraryWidth} setLibraryWidth={layout.setLibraryWidth} assistantWidth={layout.assistantWidth} setAssistantWidth={layout.setAssistantWidth} library={<ExtractedArticleLibraryPanel articles={workspace.articles} selectedArticleId={workspace.selectedArticleId} selectArticle={workspace.setSelectedArticleId} collapsed={layout.libraryCollapsed} setCollapsed={layout.setLibraryCollapsed} createBlank={createBlank} openStyleProfile={() => layout.setView("style-profile")} openSettings={openSettings} language={workspace.selectedArticle?.language} saveState={workspace.saveState} />} assistant={<ExtractedEditorialAssistantPanel state={editorial.state} message={editorial.message} onRequest={editorial.request} onCancel={editorial.cancel} collapsed={layout.assistantCollapsed} setCollapsed={layout.setAssistantCollapsed} language={layout.targetLanguage} />}>
        <ExtractedArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} createBlank={createBlank} />
        <ExtractedRestoreRevisionDialog candidate={revisions.candidate} hasUncommittedChanges={workspace.hasUncommittedChanges} close={() => revisions.setCandidate(undefined)} restore={revisions.restore} />
    </ExtractedWorkspaceShell>;
}
