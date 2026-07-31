import { useEffect, useMemo, useRef, useState } from "react";
import {
    applyProposalChanges,
    countPublishingCharacters,
    createTextProposal,
    defaultPublishLimitProfileId,
    getPublishLimitProfile,
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
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Banner } from "../ui/primitives.js";
import { EditorialAssistantPanel as ExtractedEditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleLibraryPanel as ExtractedArticleLibraryPanel } from "./components/ArticleLibraryPanel.js";
import { ArticleWorkspace as ExtractedArticleWorkspace } from "./components/ArticleWorkspace.js";
import { RestoreRevisionDialog as ExtractedRestoreRevisionDialog } from "./components/RestoreRevisionDialog.js";
import { WorkspaceShell as ExtractedWorkspaceShell } from "./components/WorkspaceShell.js";

export type WorkspaceView = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "publish";
type SaveState = "saved" | "saving" | "error";
type ProposalState = "idle" | "streaming" | "error";

function useArticleWorkspace(client: EditorialWorkspaceClient) {
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string>();
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [state, setState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState("Loading your local articles…");
    const [saveState, setSaveState] = useState<SaveState>("saved");
    const revisions = useRef(new Map<string, string>());
    const saveQueue = useRef(Promise.resolve());


    useEffect(() => {
        client.listArticles().then((loaded) => {
            setArticles(loaded);
            setDrafts(Object.fromEntries(loaded.map((article) => [article.id, article.currentRevision.content])));
            revisions.current = new Map(loaded.map((article) => [article.id, article.currentRevisionId]));
            setSelectedArticleId(loaded[0]?.id);
            setState("ready");
        }).catch(() => {
            setState("error");
            setMessage("Your local service is unavailable. Start it, then retry.");
        });
    }, [client]);


    const selectedArticle = articles.find((article) => article.id === selectedArticleId);
    const content = selectedArticleId ? drafts[selectedArticleId] ?? "" : "";


    function updateRevision(articleId: string, revision: ArticleRevision) {
        revisions.current.set(articleId, revision.id);
        setArticles((items) => items.map((article) => article.id === articleId ? {
            ...article,
            updatedAt: revision.createdAt,
            currentRevisionId: revision.id,
            currentRevision: revision,
        } : article));
    }


    async function save(articleId = selectedArticleId): Promise<ArticleRevision | undefined> {
        if (!articleId)
            return undefined;

        const draft = drafts[articleId] ?? "";
        const baseRevisionId = revisions.current.get(articleId);
        if (!baseRevisionId || selectedArticle?.currentRevision.content === draft)
            return undefined;

        setSaveState("saving");
        const task = saveQueue.current.then(async () => {
            const revision = await client.saveArticleRevision(articleId, { content: draft, baseRevisionId });
            updateRevision(articleId, revision);
            setSaveState("saved");
            return revision;
        });
        saveQueue.current = task.then(() => undefined, () => undefined);

        try {
            return await task;
        } catch (error) {
            setSaveState("error");
            setMessage(error instanceof Error ? error.message : "Couldn’t save the article.");
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


    async function rename(articleId: string, title: string) {
        const article = await client.renameArticle(articleId, title);
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

    return {
        articles,
        selectedArticle,
        selectedArticleId,
        setSelectedArticleId,
        content,
        setContent: (value: string) => selectedArticleId && setDrafts((items) => ({ ...items, [selectedArticleId]: value })),
        state,
        message,
        saveState,
        save,
        create,
        rename,
        remove,
        updateRevision
    };
}


function useArticleRevisions(client: EditorialWorkspaceClient, article: Article | undefined, updateRevision: (articleId: string, revision: ArticleRevision) => void) {
    const [revisions, setRevisions] = useState<ArticleRevision[]>([]);
    const [candidate, setCandidate] = useState<ArticleRevision>();
    const [message, setMessage] = useState("");
    const articleId = article?.id;
    const currentRevisionId = article?.currentRevisionId;

    useEffect(() => {
        if (!articleId) {
            setRevisions([]);
            return;
        }

        client.listArticleRevisions(articleId).then(setRevisions).catch(() => setMessage("Couldn’t load revision history."));
    }, [articleId, currentRevisionId, client]);

    async function restore() {
        if (!article || !candidate)
            return;

        const revision = await client.restoreRevision(article.id, candidate.id);
        updateRevision(article.id, revision);
        setRevisions((items) => [...items, revision]);
        setCandidate(undefined);
    }

    return { revisions, candidate, setCandidate, restore, message };
}


function useEditorialProposal(client: EditorialWorkspaceClient, workspace: ReturnType<typeof useArticleWorkspace>) {
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
                    setMessage(event.message);
                }
            }, controller.current.signal);
        } catch (error) {
            if ((error as DOMException).name !== "AbortError") {
                setState("error");
                setMessage(error instanceof Error ? error.message : "The editorial request failed.");
            }
        }
    }


    async function accept() {
        const article = workspace.selectedArticle;
        if (!article || !base || !review || stale)
            return;

        const content = applyProposalChanges(review, selectedChanges);
        const revision = await client.acceptProposal(article.id, { baseRevisionId: base.revisionId, content, provenance: { kind: "accepted-proposal" } });

        workspace.updateRevision(article.id, revision);
        workspace.setContent(content);
        setProposal("");
        setBase(undefined);
        setSelectedChanges(new Set());
    }


    async function createTranslation() {
        const article = workspace.selectedArticle;
        if (!article || !translation || !base || stale)
            return;

        await workspace.create({
            title: `${article.title} — ${translation.targetLanguage}`,
            content: proposal,
            language: translation.targetLanguage,
            sourceArticleId: article.id,
            sourceRevisionId: base.revisionId
        });
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


function useStyleCorpus(client: EditorialWorkspaceClient) {
    const [corpus, setCorpus] = useState<StyleCorpus>();

    useEffect(() => {
        client.getStyleCorpus().then(setCorpus).catch(() => undefined);
    }, [client]);

    return {
        corpus,
        add: async (name: string, content: string) => setCorpus(await client.addStyleCorpusItem({ name, content })),
        remove: async (id: string) => {
            await client.removeStyleCorpusItem(id);
            setCorpus(await client.getStyleCorpus());
        }
    };
}


function usePublishing(client: EditorialWorkspaceClient, content: string) {
    const [profileId, setProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);
    const [message, setMessage] = useState<{ text: string; tone: "info" | "success" | "error" }>({ text: "", tone: "info" });

    useEffect(() => {
        client.getPublishLimitProfile()
            .then(setProfileId)
            .catch(() => setMessage({ text: "Using the default publishing profile.", tone: "info" }));
    }, [client]);

    const text = preparePlainTextForPublishing(content);

    return {
        text,
        count: countPublishingCharacters(text),
        profileId,
        profile: getPublishLimitProfile(profileId),
        message: message.text,
        messageTone: message.tone,
        setProfile: async (id: PublishLimitProfileId) => {
            setProfileId(await client.setPublishLimitProfile(id));
        },
        copy: async () => {
            try {
                await navigator.clipboard.writeText(text);
                setMessage({ text: "Publishing text copied.", tone: "success" });
            } catch {
                setMessage({ text: "Copy failed. Select the publishing text and copy it manually.", tone: "error" });
            }
        }
    };
}


function useWorkspaceLayout() {
    const [view, setView] = useState<WorkspaceView>("write");
    const [libraryCollapsed, setLibraryCollapsed] = useState(() => localStorage.getItem("skladno-navigation-collapsed") === "true");
    const [assistantCollapsed, setAssistantCollapsed] = useState(() => localStorage.getItem("skladno-assistant-collapsed") === "true");
    const [focusMode, setFocusMode] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState("Spanish");

    useEffect(() => localStorage.setItem("skladno-navigation-collapsed", String(libraryCollapsed)), [libraryCollapsed]);
    useEffect(() => localStorage.setItem("skladno-assistant-collapsed", String(assistantCollapsed)), [assistantCollapsed]);

    return { view, setView, libraryCollapsed, setLibraryCollapsed, assistantCollapsed, setAssistantCollapsed, focusMode, setFocusMode, targetLanguage, setTargetLanguage };
}


export type ArticleWorkspaceState = ReturnType<typeof useArticleWorkspace>;
export type ArticleRevisionsState = ReturnType<typeof useArticleRevisions>;
export type EditorialProposalState = ReturnType<typeof useEditorialProposal>;
export type StyleCorpusState = ReturnType<typeof useStyleCorpus>;
export type PublishingState = ReturnType<typeof usePublishing>;
export type WorkspaceLayoutState = ReturnType<typeof useWorkspaceLayout>;


export function EditorialWorkspaceProvider({ client }: { client: EditorialWorkspaceClient }) {
    const workspace = useArticleWorkspace(client);
    const layout = useWorkspaceLayout();
    const revisions = useArticleRevisions(client, workspace.selectedArticle, workspace.updateRevision);
    const editorial = useEditorialProposal(client, workspace);
    const corpus = useStyleCorpus(client);
    const publishing = usePublishing(client, workspace.content);

    function createBlank() {
        return workspace.create({
            title: "Untitled article",
            content: ""
        });
    }

    if (workspace.state === "loading")
        return <main className="grid min-h-screen place-items-center text-muted">
            Loading your Article Library…
        </main>;

    if (workspace.state === "error")
        return <main className="grid min-h-screen place-items-center">
            <Banner tone="error" role="alert">{workspace.message}</Banner>
        </main>;

    return <ExtractedWorkspaceShell focusMode={layout.focusMode} library={<ExtractedArticleLibraryPanel articles={workspace.articles} selectedArticleId={workspace.selectedArticleId} selectArticle={workspace.setSelectedArticleId} collapsed={layout.libraryCollapsed} setCollapsed={layout.setLibraryCollapsed} createBlank={createBlank} openStyleProfile={() => layout.setView("style-profile")} language={workspace.selectedArticle?.language} saveState={workspace.saveState} />} assistant={<ExtractedEditorialAssistantPanel state={editorial.state} message={editorial.message} onRequest={editorial.request} onCancel={editorial.cancel} collapsed={layout.assistantCollapsed} setCollapsed={layout.setAssistantCollapsed} language={layout.targetLanguage} />}>
        <ExtractedArticleWorkspace workspace={workspace} layout={layout} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} createBlank={createBlank} />
        <ExtractedRestoreRevisionDialog candidate={revisions.candidate} close={() => revisions.setCandidate(undefined)} restore={revisions.restore} />
    </ExtractedWorkspaceShell>;
}
