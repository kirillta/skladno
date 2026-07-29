import { useEffect, useRef, useState } from "react";
import { applyProposalChanges, countPublishingCharacters, createTextProposal, defaultPublishLimitProfileId, DocumentConflictError, EDITORIAL_OPERATION, FACT_CHECK_STATUS, getPublishLimitProfile, preparePlainTextForPublishing, publishLimitProfiles, type Document, type DocumentVersion, type EditorialOperation, type EditorialEvent, type FactCheck, type PublishLimitProfileId, type StyleCorpus, type StyleReview, type TextProposal, type TranslationMetadata } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client";
import { Button, Dialog, Diff, EmptyState, Field, Select, Tab, TabList, TextareaField } from "./ui/primitives";

type WorkspaceState = "loading" | "ready" | "error";
type SaveState = "saved" | "saving" | "error";
type WorkspaceTab = "editor" | "diff" | "history" | "fact-check" | "style" | "translations" | "publish";
type AssistantEntry = { id: string; text: string; tone: "info" | "success" | "error"; timestamp: string };


const workflowStages = ["Talking points", "Narrative draft", "Author editing", "Flow and clarity", "Fact-checking", "Style review", "Translation", "Publication preview"] as const;
const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "editor", label: "Editor" },
    { id: "diff", label: "Diff" },
    { id: "history", label: "Version History" },
    { id: "fact-check", label: "Fact Check" },
    { id: "style", label: "Style Profile" },
    { id: "translations", label: "Translations" },
    { id: "publish", label: "Publish" },
];


enum EditorialState {
    Idle = "idle",
    Streaming = "streaming",
    Error = "error",
}


const client = new HttpApplicationClient();

const ui = {
    primaryButton: "rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-55",
    secondaryButton: "rounded-md border border-brand/60 px-2.5 py-1.5 text-xs font-medium text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-55",
    textButton: "text-xs text-brand underline underline-offset-2 hover:text-brand/75 disabled:cursor-not-allowed disabled:opacity-55",
    field: "w-full rounded-md border border-border bg-white/50 px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-brand focus:ring-2 focus:ring-brand/20",
    sidebarSection: "mx-2 mt-4 border-t border-border pt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_p]:mt-2 [&_p]:text-xs [&_p]:leading-5 [&_p]:text-muted [&_label]:mt-3 [&_label]:grid [&_label]:gap-1 [&_label]:text-xs [&_label]:text-muted [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-border [&_input]:bg-white/50 [&_input]:px-2 [&_input]:py-1.5 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-brand [&_input]:focus:ring-2 [&_input]:focus:ring-brand/20 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-border [&_textarea]:bg-white/50 [&_textarea]:p-2 [&_textarea]:text-sm [&_textarea]:outline-none [&_textarea]:focus:border-brand [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-brand/20 [&_button]:rounded-md [&_button]:bg-brand [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-xs [&_button]:font-medium [&_button]:text-white [&_button]:hover:bg-brand/90 [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-55 [&_ul]:mt-2 [&_ul]:space-y-2 [&_ul]:pl-4 [&_ol]:mt-3 [&_ol]:space-y-3 [&_ol]:pl-4 [&_li]:leading-5 [&_small]:block [&_small]:text-muted [&_output]:font-editor [&_p[data-state=error]]:text-danger",
    editorPane: "flex min-w-0 flex-col bg-surface-raised [&_header]:flex [&_header]:min-h-16 [&_header]:items-center [&_header]:gap-3 [&_header]:border-b [&_header]:border-border [&_header]:px-[clamp(1.25rem,3vw,2.5rem)] [&_header]:py-3 [&_header_h2]:truncate [&_header_h2]:text-[1.05rem] [&_header_h2]:font-semibold [&_header_p]:ml-auto [&_header_p]:text-xs [&_header_p]:text-muted [&_header_p[data-state]]:hidden [&>textarea]:min-h-[62vh] [&>textarea]:w-full [&>textarea]:max-w-[46rem] [&>textarea]:flex-1 [&>textarea]:self-center [&>textarea]:resize-none [&>textarea]:bg-transparent [&>textarea]:px-1 [&>textarea]:py-9 [&>textarea]:font-editor [&>textarea]:text-[1.05rem] [&>textarea]:leading-8 [&>textarea]:outline-none [&>textarea]:placeholder:text-ink/40",
    mutedText: "text-xs leading-5 text-muted",
};


function newArticleTitle(documents: Document[]): string {
    return `Untitled article${documents.length ? ` ${documents.length + 1}` : ""}`;
}


export function App() {
    const [state, setState] = useState<WorkspaceState>("loading");
    const [message, setMessage] = useState("Loading your local articles…");
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedId, setSelectedId] = useState<string>();
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saveState, setSaveState] = useState<SaveState>("saved");
    const [renameId, setRenameId] = useState<string>();
    const [renameValue, setRenameValue] = useState("");
    const versions = useRef(new Map<string, string>());
    const saveQueue = useRef(Promise.resolve());
    const draftsRef = useRef(drafts);
    const selectedRef = useRef(selectedId);
    const editorialRequest = useRef<AbortController>();
    const [editorialContext, setEditorialContext] = useState("");
    const [proposal, setProposal] = useState("");
    const [proposalBase, setProposalBase] = useState<{ content: string; versionId: string }>();
    const [proposalResponseId, setProposalResponseId] = useState<string>();
    const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
    const [history, setHistory] = useState<DocumentVersion[]>([]);
    const [historyMessage, setHistoryMessage] = useState("");
    const [editorialState, setEditorialState] = useState(EditorialState.Idle);
    const [editorialMessage, setEditorialMessage] = useState("");
    const [lastEditorialOperation, setLastEditorialOperation] = useState<EditorialOperation>();
    const [styleCorpus, setStyleCorpus] = useState<StyleCorpus>();
    const [styleCorpusName, setStyleCorpusName] = useState("");
    const [styleCorpusContent, setStyleCorpusContent] = useState("");
    const [styleCorpusMessage, setStyleCorpusMessage] = useState("");
    const [styleReview, setStyleReview] = useState<StyleReview>();
    const [factCheck, setFactCheck] = useState<FactCheck>();
    const [targetLanguage, setTargetLanguage] = useState("Spanish");
    const [translation, setTranslation] = useState<TranslationMetadata>();
    const [publishLimitProfileId, setPublishLimitProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);
    const [publishMessage, setPublishMessage] = useState("");
    const [libraryQuery, setLibraryQuery] = useState("");
    const [navigationCollapsed, setNavigationCollapsed] = useState(() => localStorage.getItem("skladno-navigation-collapsed") === "true");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newDocumentTitle, setNewDocumentTitle] = useState("");
    const [newDocumentPoints, setNewDocumentPoints] = useState("");
    const [newDocumentLanguage, setNewDocumentLanguage] = useState("English");
    const [newDocumentAudience, setNewDocumentAudience] = useState("");
    const [workflowStage, setWorkflowStage] = useState(() => localStorage.getItem("skladno-workflow-stage") ?? "Author editing");
    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("editor");
    const [distractionFree, setDistractionFree] = useState(() => localStorage.getItem("skladno-distraction-free") === "true");
    const [assistantCollapsed, setAssistantCollapsed] = useState(() => localStorage.getItem("skladno-assistant-collapsed") === "true");
    const [assistantHistory, setAssistantHistory] = useState<AssistantEntry[]>([]);
    draftsRef.current = drafts;
    selectedRef.current = selectedId;

    useEffect(() => {
        client.listDocuments().then((loaded) => {
            setDocuments(loaded);
            setDrafts(Object.fromEntries(loaded.map((document) => [document.id, document.currentVersion.content])));
            versions.current = new Map(loaded.map((document) => [document.id, document.currentVersionId]));
            setSelectedId(loaded[0]?.id);
            setState("ready");
        }).catch(() => {
            setState("error");
            setMessage("Your local service is unavailable. Start it, then retry.");
        });
        client.getStyleCorpus().then(setStyleCorpus).catch(() => setStyleCorpusMessage("Couldn’t load your local style corpus."));
        client.getPublishLimitProfile().then(setPublishLimitProfileId).catch(() => setPublishMessage("Using the default publishing profile until local settings are available."));
    }, []);


    useEffect(() => {
        if (selectedId)
            loadHistory(selectedId);
    }, [selectedId]);

    const selected = documents.find((document) => document.id === selectedId);
    const content = selectedId ? drafts[selectedId] ?? "" : "";
    const review: TextProposal | undefined = proposalBase 
        ? createTextProposal(proposalBase.content, proposal) 
        : undefined;
    const proposalIsStale = Boolean(selected && proposalBase && proposalBase.versionId !== selected.currentVersionId);
    const publishText = preparePlainTextForPublishing(content);
    const publishCharacterCount = countPublishingCharacters(publishText);
    const publishLimitProfile = getPublishLimitProfile(publishLimitProfileId);
    const visibleDocuments = documents.filter((document) => `${document.title} ${document.language ?? ""} ${document.audience ?? ""}`.toLocaleLowerCase().includes(libraryQuery.trim().toLocaleLowerCase()));


    function loadHistory(documentId: string) {
        client.listVersions(documentId).then(setHistory).catch(() => setHistoryMessage("Couldn’t load version history."));
    }


    function updateSavedVersion(documentId: string, versionId: string, savedContent: string) {
        versions.current.set(documentId, versionId);
        setDocuments((items) => items.map((item) => item.id === documentId
            ? { ...item, updatedAt: new Date().toISOString(), currentVersionId: versionId, currentVersion: { ...item.currentVersion, id: versionId, content: savedContent } }
            : item));
    }


    function save(documentId: string, draft: string): Promise<boolean> {
        setSaveState("saving");
        const queuedSave = saveQueue.current.then(async () => {
            const baseVersionId = versions.current.get(documentId);
            if (!baseVersionId)
                return false;

            try {
                const version = await client.saveDraft(documentId, { content: draft, baseVersionId });
                updateSavedVersion(documentId, version.id, version.content);
                if (selectedRef.current === documentId)
                    setSaveState("saved");

                return true;
            } catch (error) {
                if (error instanceof DocumentConflictError) {
                    versions.current.set(documentId, error.document.currentVersionId);
                    setDocuments((items) => items.map((item) => item.id === documentId ? error.document : item));
                }

                if (selectedRef.current === documentId)
                    setSaveState("error");

                return false;
            }
        });

        saveQueue.current = queuedSave.then(() => undefined);
        return queuedSave;
    }


    function selectArticle(documentId: string) {
        if (selected && selected.id !== documentId) {
            const currentDraft = draftsRef.current[selected.id] ?? "";
            if (currentDraft !== selected.currentVersion.content) 
                save(selected.id, currentDraft);
        }

        setSelectedId(documentId);
        loadHistory(documentId);
    }


    useEffect(() => {
        if (!selectedId || state !== "ready") 
            return;

        const savedContent = selected?.currentVersion.content;
        if (content === savedContent) 
            return;

        const timer = window.setTimeout(() => save(selectedId, content), 500);
        return () => window.clearTimeout(timer);
    }, [content, selectedId, state]); // Deliberately serialised by saveQueue.


    async function createArticle() {
        try {
            const created = await client.createDocument({ title: newArticleTitle(documents), content: "" });
            versions.current.set(created.id, created.currentVersionId);
            
            setDocuments((items) => [created, ...items]);
            setDrafts((items) => ({ ...items, [created.id]: "" }));
            setSelectedId(created.id);
            setHistory([created.currentVersion]);
            setSaveState("saved");
        } catch {
            setSaveState("error");
        }
    }


    function toggleNavigation() {
        setNavigationCollapsed((current) => {
            const next = !current;
            localStorage.setItem("skladno-navigation-collapsed", String(next));
            return next;
        });
    }


    function changeWorkflowStage(stage: string) {
        localStorage.setItem("skladno-workflow-stage", stage);
        setWorkflowStage(stage);
    }


    function toggleDistractionFree() {
        setDistractionFree((current) => {
            const next = !current;
            localStorage.setItem("skladno-distraction-free", String(next));
            return next;
        });
    }


    function toggleAssistantPanel() {
        setAssistantCollapsed((current) => {
            const next = !current;
            localStorage.setItem("skladno-assistant-collapsed", String(next));
            return next;
        });
    }


    function addAssistantEntry(text: string, tone: AssistantEntry["tone"] = "info") {
        setAssistantHistory((items) => [{ id: crypto.randomUUID(), text, tone, timestamp: new Date().toISOString() }, ...items].slice(0, 20));
    }


    async function createDocumentFromFlow(startFromPoints: boolean) {
        const title = newDocumentTitle.trim() || newArticleTitle(documents);
        const points = newDocumentPoints.trim();

        try {
            const created = await client.createDocument({
                title,
                content: startFromPoints ? points : "",
                language: newDocumentLanguage.trim() || "English",
                ...(newDocumentAudience.trim() ? { audience: newDocumentAudience.trim() } : {}),
                publishingProfileId: publishLimitProfileId,
                provenance: { kind: startFromPoints ? "author-talking-points" : "initial" },
            });
            versions.current.set(created.id, created.currentVersionId);
            setDocuments((items) => [created, ...items]);
            setDrafts((items) => ({ ...items, [created.id]: created.currentVersion.content }));
            setSelectedId(created.id);
            setHistory([created.currentVersion]);
            setEditorialContext(startFromPoints ? points : "");
            setIsCreateDialogOpen(false);
            setNewDocumentTitle("");
            setNewDocumentPoints("");
            setNewDocumentAudience("");
            if (startFromPoints)
                void requestEditorialProposal(EDITORIAL_OPERATION.THESIS_TO_NARRATIVE, created, points);
            else
                setEditorialMessage("Empty draft created locally.");
        } catch {
            setSaveState("error");
        }
    }


    async function commitRename(documentId: string) {
        const title = renameValue.trim();
        setRenameId(undefined);
        if (!title) 
            return;

        try {
            const renamed = await client.renameDocument(documentId, title);
            setDocuments((items) => items.map((item) => item.id === documentId ? renamed : item));
        } catch { setSaveState("error"); }
    }


    async function deleteArticle(document: Document) {
        if (!window.confirm(`Delete “${document.title}”? This removes its saved draft and history.`)) 
            return;

        try {
            await client.deleteDocument(document.id);
            versions.current.delete(document.id);
            setDocuments((items) => items.filter((item) => item.id !== document.id));
            setDrafts((items) => { const { [document.id]: _, ...remaining } = items; return remaining; });
            if (selectedId === document.id) 
                setSelectedId(documents.find((item) => item.id !== document.id)?.id);
        } catch { 
            setSaveState("error"); 
        }
    }


    async function requestEditorialProposal(operation: EditorialOperation, document = selected, context = editorialContext) {
        if (!document)
            return;

        const draft = draftsRef.current[document.id] ?? document.currentVersion.content;
        if (draft !== document.currentVersion.content) {
            const saved = await save(document.id, draft);
            if (!saved) {
                setEditorialState(EditorialState.Error);
                setEditorialMessage("Couldn’t save the current article, so no text was sent for review. Retry saving, then try again.");

                return;
            }
        }

        const controller = new AbortController();
        editorialRequest.current = controller;
        setProposal("");
        setProposalBase({ content: draft, versionId: versions.current.get(document.id)! });
        setProposalResponseId(undefined);
        setStyleReview(undefined);
        setFactCheck(undefined);
        setTranslation(undefined);
        setSelectedChanges(new Set());
        setEditorialState(EditorialState.Streaming);
        setLastEditorialOperation(operation);
        setEditorialMessage("Preparing a proposal…");
        addAssistantEntry(`Reviewing saved revision ${versions.current.get(document.id)?.slice(0, 8) ?? "current"}. Your article will not change automatically.`);

        try {
            await client.streamEditorial(document.id, {
                requestId: crypto.randomUUID(),
                operation,
            authorContext: context,
                ...(operation === EDITORIAL_OPERATION.TRANSLATION ? { targetLanguage } : {}),
            }, (event: EditorialEvent) => {
                if (event.type === "text_delta") {
                    setProposal((current) => current + event.delta);
                    setEditorialMessage("Writing proposal…");
                } else if (event.type === "tool_status") {
                    setEditorialMessage(`${event.status === "started" ? "Using" : "Finished"} ${event.tool.replace("_", " ")}.`);
                } else if (event.type === "completed") {
                    setProposal(event.text);
                    setProposalResponseId(event.responseId);
                    setStyleReview(event.styleReview);
                    setFactCheck(event.factCheck);
                    setTranslation(event.translation);
                    setEditorialState(EditorialState.Idle);
                    setEditorialMessage(event.factCheck ? "Fact check ready. It has not changed your article." : "Proposal ready for review. It has not changed your article.");
                    addAssistantEntry(event.factCheck ? "Fact check completed. Findings are advisory." : "Proposal completed. Review it before accepting any changes.", "success");
                } else {
                    setEditorialState(EditorialState.Error);
                    setEditorialMessage(event.message);
                }
            }, controller.signal);
        } catch (error) {
            if (!controller.signal.aborted) {
                setEditorialState(EditorialState.Error);
                setEditorialMessage(error instanceof Error ? error.message : "Couldn’t get a proposal. Retry when ready.");
                addAssistantEntry("The request failed. No article text or revision history was changed.", "error");
            }
        } finally {
            if (editorialRequest.current === controller)
                editorialRequest.current = undefined;
        }
    }


    function cancelEditorialProposal() {
        editorialRequest.current?.abort();
        editorialRequest.current = undefined;
        setProposal("");
        setProposalBase(undefined);
        setSelectedChanges(new Set());
        setStyleReview(undefined);
        setFactCheck(undefined);
        setTranslation(undefined);
        setEditorialState(EditorialState.Idle);
        setEditorialMessage("Proposal cancelled. Your article is unchanged.");
        addAssistantEntry("Request cancelled. No article text or revision history was changed.");
    }


    function toggleProposalChange(changeId: string) {
        setSelectedChanges((current) => {
            const next = new Set(current);
            if (next.has(changeId))
                next.delete(changeId);
            else
                next.add(changeId);

            return next;
        });
    }


    async function acceptProposal(changeIds = selectedChanges) {
        if (!selected || !proposalBase || !review || changeIds.size === 0)
            return;

        try {
            const version = await client.acceptProposal(selected.id, {
                baseVersionId: proposalBase.versionId,
                content: applyProposalChanges(review, changeIds),
                provenance: {
                    kind: "accepted-proposal",
                    operation: lastEditorialOperation,
                    responseId: proposalResponseId,
                    acceptedChangeIds: [...changeIds],
                },
            });

            updateSavedVersion(selected.id, version.id, version.content);
            setDrafts((items) => ({ ...items, [selected.id]: version.content }));
            setProposal("");
            setProposalBase(undefined);
            setSelectedChanges(new Set());
            setStyleReview(undefined);
            setEditorialMessage("Accepted changes were saved as a new version.");
            loadHistory(selected.id);
        } catch (error) {
            setEditorialState(EditorialState.Error);
            setEditorialMessage(error instanceof Error ? `${error.message} Review the proposal again against the current article.` : "Couldn’t accept this proposal.");
        }
    }


    async function acceptTranslation() {
        if (!selected || !translation || !proposal.trim())
            return;

        try {
            const created = await client.createDocument({
                title: `${selected.title} — ${translation.targetLanguage}`,
                content: proposal,
                language: translation.targetLanguage,
                sourceDocumentId: selected.id,
                provenance: {
                    kind: "accepted-translation",
                    sourceDocumentId: selected.id,
                    sourceVersionId: proposalBase?.versionId,
                    targetLanguage: translation.targetLanguage,
                    responseId: proposalResponseId,
                    protectedSpans: translation.protectedSpans,
                },
            });
            versions.current.set(created.id, created.currentVersionId);
            setDocuments((items) => [created, ...items]);
            setDrafts((items) => ({ ...items, [created.id]: created.currentVersion.content }));
            setSelectedId(created.id);
            setHistory([created.currentVersion]);
            setProposal("");
            setProposalBase(undefined);
            setTranslation(undefined);
            setEditorialMessage("Translation saved as its own linked article. You can edit and restore it independently.");
        } catch (error) {
            setEditorialState(EditorialState.Error);
            setEditorialMessage(error instanceof Error ? error.message : "Couldn’t create the translation article.");
        }
    }


    function rejectProposal() {
        setProposal("");
        setProposalBase(undefined);
        setSelectedChanges(new Set());
        setStyleReview(undefined);
        setFactCheck(undefined);
        setTranslation(undefined);
        setEditorialMessage("Proposal rejected. Your article is unchanged.");
    }


    async function addStyleCorpusItem() {
        const name = styleCorpusName.trim();
        if (!name || !styleCorpusContent.trim()) {
            setStyleCorpusMessage("Give the sample a name and include its article text.");
            return;
        }

        try {
            const updated = await client.addStyleCorpusItem({ name, content: styleCorpusContent });
            setStyleCorpus(updated);
            setStyleCorpusName("");
            setStyleCorpusContent("");
            setStyleCorpusMessage("Style sample stored locally. Its compact profile is ready for review.");
        } catch (error) {
            setStyleCorpusMessage(error instanceof Error ? error.message : "Couldn’t add the style sample.");
        }
    }


    async function removeStyleCorpusItem(materialId: string) {
        try {
            await client.removeStyleCorpusItem(materialId);
            setStyleCorpus(await client.getStyleCorpus());
            setStyleCorpusMessage("Style sample removed from local storage.");
        } catch (error) {
            setStyleCorpusMessage(error instanceof Error ? error.message : "Couldn’t remove the style sample.");
        }
    }


    async function restoreVersion(version: DocumentVersion) {
        if (!selected)
            return;

        if (!window.confirm("Restore this version? The current article will remain in history and the restore will create a new version."))
            return;

        try {
            const restored = await client.restoreVersion(selected.id, version.id);
            
            updateSavedVersion(selected.id, restored.id, restored.content);
            setDrafts((items) => ({ ...items, [selected.id]: restored.content }));
            setHistoryMessage("Version restored as a new saved version.");
            loadHistory(selected.id);
        } catch (error) {
            setHistoryMessage(error instanceof Error ? error.message : "Couldn’t restore this version.");
        }
    }

    async function selectPublishLimitProfile(profileId: PublishLimitProfileId) {
        setPublishLimitProfileId(profileId);

        try {
            const savedProfileId = await client.setPublishLimitProfile(profileId);
            setPublishLimitProfileId(savedProfileId);
            setPublishMessage("Publishing profile saved locally.");
        } catch (error) {
            setPublishMessage(error instanceof Error ? error.message : "Couldn’t save the publishing profile locally.");
        }
    }


    async function copyPublishingText() {
        if (!selected)
            return;

        try {
            await navigator.clipboard.writeText(publishText);
            setPublishMessage("Plain text copied. It matches the preview below.");
        } catch {
            setPublishMessage("Couldn’t copy automatically. Select the preview text and copy it manually.");
        }
    }

    
    if (state !== "ready") 
        return <main className="min-h-screen bg-canvas px-8 pt-[12vh] font-ui text-ink"><div className="mx-auto max-w-2xl"><h1 className="text-lg font-semibold tracking-tight">Skladno</h1><p className="mt-2 text-sm text-muted" aria-live="polite" data-state={state}>{message}</p></div></main>;

    return <main className={`grid min-h-screen grid-cols-1 bg-canvas font-ui text-ink md:h-screen ${distractionFree ? "md:grid-cols-[minmax(0,1fr)]" : assistantCollapsed ? navigationCollapsed ? "md:grid-cols-[2.75rem_minmax(0,1fr)]" : "md:grid-cols-[14rem_minmax(0,1fr)]" : navigationCollapsed ? "md:grid-cols-[2.75rem_minmax(0,1fr)_20rem]" : "md:grid-cols-[14rem_minmax(0,1fr)_20rem]"}`}>
        <aside className={`${distractionFree ? "hidden" : ""} flex overflow-x-hidden overflow-y-auto border-b border-border bg-surface py-4 md:flex-col md:border-r md:border-b-0`} aria-label="Document navigation">
            <div className={`flex items-center border-b border-border pb-4 ${navigationCollapsed ? "justify-center px-1" : "justify-between px-3"}`}><h1 className={navigationCollapsed ? "sr-only" : "text-sm font-semibold tracking-tight text-brand"}>✦&nbsp; Skladno</h1><Button type="button" variant="quiet" className={navigationCollapsed ? "size-9 min-h-9 shrink-0 p-0 font-semibold text-brand" : "size-9 min-h-9 shrink-0 p-0 text-2xl leading-none"} aria-label={navigationCollapsed ? "Expand navigation" : "Collapse navigation"} onClick={toggleNavigation}>{navigationCollapsed ? "S" : "‹"}</Button></div>
            <div className={`flex px-3 pt-3 ${navigationCollapsed ? "justify-center" : "items-center justify-between"}`}><span className={navigationCollapsed ? "sr-only" : "text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted"}>Workspace</span><Button type="button" variant="quiet" className="min-h-8 px-2 py-1 text-base" aria-label="Create document" onClick={() => setIsCreateDialogOpen(true)}>+</Button></div>
            {!navigationCollapsed && <>
                <label className="mx-3 mt-3 grid gap-1 text-xs text-muted"><span className="sr-only">Search documents</span><Field className="min-h-8 bg-surface-raised px-2 py-1.5 text-xs" aria-label="Search documents" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="⌕  Search…" /></label>
                <section className="mt-4" aria-label="Recent documents"><h2 className="px-4 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">Recent</h2>
                {documents.length === 0 ? <EmptyState title="No documents yet"><Button type="button" variant="secondary" onClick={() => setIsCreateDialogOpen(true)}>Create your first document</Button></EmptyState> : visibleDocuments.length === 0 ? <EmptyState title="No matching documents"><Button type="button" variant="quiet" onClick={() => setLibraryQuery("")}>Clear search</Button></EmptyState> : <ul className="m-0 mt-2 list-none space-y-1 p-0">
                {visibleDocuments.map((document) => <li key={document.id} className={`mx-2 rounded-control p-0.5 ${document.id === selectedId ? "bg-brand-soft" : ""}`}>
                    {renameId === document.id ? <input autoFocus aria-label="Article title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename(document.id)} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(document.id); if (event.key === "Escape") setRenameId(undefined); }} />
                        : <button type="button" className="block w-full truncate rounded px-2 py-2 text-left text-sm hover:bg-white/45" onClick={() => selectArticle(document.id)}>{document.title}<small>{document.sourceDocumentId ? `Linked translation · ${document.language ?? "language not set"}` : `${document.language ?? "Language not set"} · ${new Date(document.updatedAt).toLocaleDateString()}`}</small></button>}
                    <div className="hidden"><button type="button" onClick={() => { setRenameId(document.id); setRenameValue(document.title); }}>Rename</button><button type="button" onClick={() => void deleteArticle(document)}>Delete</button></div>
                </li>)}</ul>}</section>
                <div className="mt-auto border-t border-border pt-3"><button type="button" className="w-full px-4 py-2 text-left text-xs text-muted hover:bg-brand-soft"><span className="mr-2 text-sm" aria-hidden="true">◒</span>Style profile</button><button type="button" className="w-full px-4 py-2 text-left text-xs text-muted hover:bg-brand-soft"><span className="mr-2 text-sm" aria-hidden="true">⚙</span>Settings</button><p className="px-4 pt-2 text-[0.65rem] text-muted">EN</p></div>
            </>}
            {navigationCollapsed && <div className="mt-auto grid justify-items-center gap-1 border-t border-border py-3"><Button type="button" variant="quiet" className="min-h-8 px-2 py-1 text-base" aria-label="Style profile" title="Style profile">◒</Button><Button type="button" variant="quiet" className="min-h-8 px-2 py-1 text-base" aria-label="Settings" title="Settings">⚙</Button><span className="pt-1 text-[0.65rem] text-muted" aria-label="English">EN</span></div>}
            {!navigationCollapsed && <>
            <div className="hidden">
            <section className={ui.sidebarSection} aria-label="Publish mode">
                <h2>Publish to LinkedIn</h2>
                <p>Prepare a local plain-text copy. This never saves or changes your article.</p>
                <label>Length guidance
                    <Select aria-label="Publishing length profile" value={publishLimitProfileId} onChange={(event) => void selectPublishLimitProfile(event.target.value as PublishLimitProfileId)}>
                        {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} ({profile.characterLimit.toLocaleString()} characters)</option>)}
                    </Select>
                </label>
                <p className={`text-xs ${publishCharacterCount > publishLimitProfile.characterLimit ? "text-danger" : publishCharacterCount >= publishLimitProfile.warningThreshold ? "text-caution" : "text-brand"}`} aria-live="polite">
                    {publishCharacterCount.toLocaleString()} / {publishLimitProfile.characterLimit.toLocaleString()} characters
                    {publishCharacterCount > publishLimitProfile.characterLimit ? " — over this profile’s guidance." : publishCharacterCount >= publishLimitProfile.warningThreshold ? " — nearing this profile’s guidance." : " — within this profile’s guidance."}
                </p>
                <Button type="button" onClick={() => void copyPublishingText()} disabled={!selected}>Copy plain text</Button>
                <p className="publish-format-note">Links are kept as readable text. LinkedIn may not preserve every line break or other formatting exactly after paste.</p>
                <output className="mt-2 block max-h-64 overflow-y-auto rounded-md border border-border bg-canvas p-2 font-editor text-xs leading-5 whitespace-pre-wrap select-text" aria-label="Plain-text publishing preview">{publishText || "Your plain-text preview will appear here."}</output>
                {publishMessage && <p aria-live="polite">{publishMessage}</p>}
            </section>
            <section className={ui.sidebarSection} aria-label="Editorial assistant">
                <h2>Editorial assistant</h2>
                <p>Choose a workflow. Skladno creates a proposal for review and never replaces the saved article.</p>
                <TextareaField aria-label="Theses or editorial guidance" value={editorialContext} onChange={(event) => setEditorialContext(event.target.value)} placeholder="Add theses, a tone, or revision guidance…" disabled={!selected || editorialState === EditorialState.Streaming} />
                <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)} disabled={!selected || editorialState === EditorialState.Streaming}>Turn theses into narrative</button>
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FLOW_REVISION)} disabled={!selected || editorialState === EditorialState.Streaming}>Revise draft for flow</button>
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FACT_CHECK)} disabled={!selected || editorialState === EditorialState.Streaming}>Check facts</button>
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.STYLE_REVIEW)} disabled={!selected || editorialState === EditorialState.Streaming || !styleCorpus?.profile}>Check style</button>
                    <label className="flex items-center gap-1 text-xs text-muted">Translate to<input aria-label="Target language" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} disabled={!selected || editorialState === EditorialState.Streaming} /></label>
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.TRANSLATION)} disabled={!selected || editorialState === EditorialState.Streaming || !targetLanguage.trim()}>Translate article</button>
                    {editorialState === EditorialState.Streaming && <button type="button" onClick={cancelEditorialProposal}>Cancel</button>}
                    {editorialState === EditorialState.Error && lastEditorialOperation && <button type="button" onClick={() => void requestEditorialProposal(lastEditorialOperation)}>Retry request</button>}
                </div>
                {editorialMessage && <p data-state={editorialState === EditorialState.Error ? "error" : undefined} aria-live="polite">{editorialMessage}</p>}
                {factCheck && editorialState === EditorialState.Idle && <section className="mt-4 border-t border-border pt-4 text-xs leading-5" aria-label="Fact check findings">
                    <h3>Fact check</h3>
                    <p>Advisory findings for this saved version. Missing evidence is not treated as truth.</p>
                    {factCheck.findings.length === 0 ? <p>No externally verifiable claims were identified.</p> : <ul>{factCheck.findings.map((finding, index) => <li key={`${finding.claim}-${index}`} data-status={finding.status}>
                        <strong>{finding.status === FACT_CHECK_STATUS.SUPPORTED ? "Supported" : finding.status === FACT_CHECK_STATUS.DISPUTED ? "Disputed" : "Unverifiable"}</strong>
                        <span>{finding.claim}</span>
                        <p>{finding.rationale}</p>
                        <small>{finding.uncertainty}</small>
                        {finding.sources.length > 0 && <ul>{finding.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.quality}{source.publishedAt ? ` · ${source.publishedAt}` : ""}{source.excerpt ? ` · ${source.excerpt}` : ""}</small></li>)}</ul>}
                    </li>)}</ul>}
                </section>}
                {proposal && translation && proposalResponseId && editorialState === EditorialState.Idle && <section className="mt-4 border-t border-border pt-4 text-xs leading-5" aria-label="Translation review">
                    <h3>Review {translation.targetLanguage} translation</h3>
                    <p>Protected code, links, and technical names were validated before this proposal. Edit the translation if needed, then save it as a separate linked article.</p>
                    <TextareaField className="mt-3 min-h-56 resize-y font-editor leading-6" aria-label="Translation proposal" value={proposal} onChange={(event) => setProposal(event.target.value)} />
                    <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void acceptTranslation()}>Accept as separate article</button><button type="button" className={ui.secondaryButton} onClick={rejectProposal}>Reject translation</button></div>
                </section>}
                {proposal && review && proposalResponseId && !translation && editorialState === EditorialState.Idle && <section className="mt-4 border-t border-border pt-4 text-xs leading-5" aria-label="Proposal review">
                    <h3>Review proposal</h3>
                    {styleReview && <section className="mt-3 rounded-md bg-brand-soft/50 p-3" aria-label="Style review findings">
                        <h4>Style review</h4>
                        <p>Advisory findings from your local corpus. Confidence: {styleCorpus?.profile?.confidence ?? "unknown"}.</p>
                        {styleReview.findings.length === 0 ? <p>No material voice divergences were identified.</p> : <ul>{styleReview.findings.map((finding, index) => <li key={`${finding.divergence}-${index}`}><strong>{finding.divergence}</strong><span>{finding.suggestion}</span><small>Corpus traits: {finding.traitIds.join(", ")}</small></li>)}</ul>}
                    </section>}
                    {review.changes.length === 0 ? <p>This proposal has no text changes. Your article is unchanged.</p> : <>
                        <p>Select the changes to accept. The proposal is compared with the saved version that was sent for review.</p>
                        <div className="grid gap-2">
                            {review.changes.map((change, index) => <label key={change.id} className="grid gap-1 rounded-md border border-border bg-canvas p-2">
                                <input type="checkbox" checked={selectedChanges.has(change.id)} onChange={() => toggleProposalChange(change.id)} />
                                <span>Change {index + 1}</span>
                                <Diff removed={change.baseLines.length > 0 ? change.baseLines.join("\n") : undefined} added={change.proposalLines.length > 0 ? change.proposalLines.join("\n") : undefined} />
                            </label>)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => void acceptProposal()} disabled={selectedChanges.size === 0}>Accept selected</button>
                            <button type="button" onClick={() => void acceptProposal(new Set(review.changes.map((change) => change.id)))}>Accept whole proposal</button>
                            <button type="button" className={ui.secondaryButton} onClick={rejectProposal}>Reject proposal</button>
                        </div>
                    </>}
                </section>}
            </section>
            <section className={ui.sidebarSection} aria-label="Style corpus">
                <h2>Your style corpus</h2>
                <p>Samples stay on this device. Only the compact profile below is sent when you check style.</p>
                {styleCorpus?.profile && <p className="mt-2 text-xs leading-5 text-muted">{styleCorpus.profile.corpusItemCount} sample(s), {styleCorpus.profile.characterCount.toLocaleString()} characters, <strong>{styleCorpus.profile.confidence}</strong> confidence.</p>}
                {styleCorpus?.profile && <ul className="my-3 grid list-none gap-2 p-0 text-xs">{styleCorpus.profile.traits.map((trait) => <li key={trait.id}><strong>{trait.label}</strong><span>{trait.evidence}</span></li>)}</ul>}
                <label>Sample name<input value={styleCorpusName} onChange={(event) => setStyleCorpusName(event.target.value)} placeholder="Published article title" /></label>
                <label>Article text<textarea value={styleCorpusContent} onChange={(event) => setStyleCorpusContent(event.target.value)} placeholder="Paste an author-provided article…" /></label>
                <button type="button" onClick={() => void addStyleCorpusItem()}>Add local sample</button>
                {styleCorpusMessage && <p aria-live="polite">{styleCorpusMessage}</p>}
                {styleCorpus && <ul className="my-3 grid list-none gap-2 p-0 text-xs">{styleCorpus.items.map((item) => <li key={item.id}><span>{item.name} ({item.characterCount.toLocaleString()} characters)</span><button type="button" onClick={() => void removeStyleCorpusItem(item.id)}>Remove</button></li>)}</ul>}
            </section>
            {selected && <section className={ui.sidebarSection} aria-label="Version history">
                <h2>Version history</h2>
                <p>Restoring creates a new version; it never overwrites history.</p>
                {historyMessage && <p aria-live="polite">{historyMessage}</p>}
                <ol>
                    {history.slice().reverse().map((version) => <li key={version.id}>
                        <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
                        <span>{typeof version.provenance.kind === "string" ? version.provenance.kind : "saved version"}</span>
                        <output>{version.content}</output>
                        <button type="button" onClick={() => void restoreVersion(version)} disabled={version.id === selected.currentVersionId}>Restore</button>
                    </li>)}
                </ol>
            </section>}
            </div>
            </>}
        </aside>
        <section className={ui.editorPane} aria-label="Article editor">
            {selected ? <><header className="flex-wrap"><div className="min-w-0"><h2>{selected.title}</h2><p className="mt-1 text-xs text-muted">Version {selected.currentVersionId.slice(0, 8)} · {selected.language ?? "Source language not set"}</p></div><Select className="max-w-44" aria-label="Workflow stage" value={workflowStage} onChange={(event) => changeWorkflowStage(event.target.value)}>{workflowStages.map((stage) => <option key={stage}>{stage}</option>)}</Select><p aria-live="polite" data-state={saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save. Your text is still here." : "Saved locally"}</p><Button type="button" variant="quiet" onClick={toggleDistractionFree}>{distractionFree ? "Show panels" : "Focus mode"}</Button>{saveState === "error" && <Button type="button" onClick={() => save(selected.id, draftsRef.current[selected.id] ?? "")}>Retry save</Button>}</header>
                <div className="border-b border-border px-[clamp(1.5rem,5vw,5rem)] pt-3"><TabList>{workspaceTabs.map((tab) => <Tab key={tab.id} selected={workspaceTab === tab.id} onClick={() => setWorkspaceTab(tab.id)}>{tab.label}{tab.id === "diff" && review?.changes.length ? ` (${review.changes.length})` : ""}{tab.id === "fact-check" && factCheck?.findings.length ? ` (${factCheck.findings.length})` : ""}</Tab>)}</TabList></div>
                {workspaceTab === "editor" ? <><div className="flex items-center justify-between px-[clamp(1.5rem,5vw,5rem)] pt-3 text-xs text-muted"><span>{workflowStage} is advisory. It never changes your text or runs AI.</span><span className={publishCharacterCount > publishLimitProfile.characterLimit ? "text-danger" : publishCharacterCount >= publishLimitProfile.warningThreshold ? "text-caution" : "text-brand"}>{publishCharacterCount.toLocaleString()} / {publishLimitProfile.characterLimit.toLocaleString()} characters</span></div><textarea aria-label="Article text" value={content} onChange={(event) => { const value = event.target.value; setDrafts((items) => ({ ...items, [selected.id]: value })); }} placeholder="Start writing…" spellCheck /></> : workspaceTab === "fact-check" ? <div className="mx-auto w-full max-w-4xl overflow-y-auto p-6"><h3 className="text-lg font-semibold">Fact check</h3>{!factCheck ? <EmptyState title="No fact check yet"><p>Check facts from the assistant to create advisory findings for a saved revision.</p></EmptyState> : <><p className="mt-2 text-sm text-muted">Advisory findings for revision {proposalBase?.versionId.slice(0, 8) ?? "reviewed revision"}. {proposalIsStale ? "The article has changed since this review; findings remain attached to their original revision." : "This is the current reviewed revision."}</p><div className="mt-4 grid gap-3">{factCheck.findings.map((finding, index) => <article key={`${finding.claim}-${index}`} className="rounded-panel border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Claim {index + 1}</h4><span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold">{finding.status === FACT_CHECK_STATUS.SUPPORTED ? "Supported" : finding.status === FACT_CHECK_STATUS.DISPUTED ? "Disputed" : "Insufficient evidence"}</span></div><p className="mt-2">{finding.claim}</p><p className="mt-2 text-sm text-muted">{finding.rationale}</p><p className="mt-2 text-xs text-muted">Uncertainty: {finding.uncertainty}</p>{finding.sources.length > 0 && <ul className="mt-3 grid gap-2">{finding.sources.map((source) => <li key={source.url}><a className="font-medium text-brand underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className="ml-2 text-xs text-muted">{source.quality}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span></li>)}</ul>}<Button type="button" variant="secondary" className="mt-3" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FLOW_REVISION)}>Propose correction</Button></article>)}</div></>}</div> : workspaceTab === "style" ? <div className="mx-auto w-full max-w-4xl overflow-y-auto p-6"><h3 className="text-lg font-semibold">Style profile</h3><p className="mt-2 text-sm text-muted">Samples remain local. Style review sends only the compact derived profile.</p>{styleCorpus?.profile ? <><div className="mt-4 rounded-panel border border-border p-4 text-sm"><strong>{styleCorpus.profile.confidence} confidence</strong><p className="mt-1 text-muted">{styleCorpus.profile.corpusItemCount} local sample(s) · {styleCorpus.profile.characterCount.toLocaleString()} characters</p></div><section className="mt-4"><h4 className="font-semibold">Profile traits</h4><ul className="mt-2 grid gap-2">{styleCorpus.profile.traits.map((trait) => <li key={trait.id} className="rounded-control border border-border p-3"><strong>{trait.label}</strong><p className="mt-1 text-sm text-muted">{trait.evidence}</p></li>)}</ul></section></> : <EmptyState title="No style profile"><p>Add a local sample below, then rebuild your profile through the existing local corpus flow.</p></EmptyState>}<section className="mt-5 border-t border-border pt-4"><h4 className="font-semibold">Local samples</h4><ul className="mt-2 grid gap-2">{styleCorpus?.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 rounded-control border border-border p-3"><span>{item.name} <small className="text-muted">{item.characterCount.toLocaleString()} characters</small></span><Button type="button" variant="danger" onClick={() => void removeStyleCorpusItem(item.id)}>Remove</Button></li>)}</ul><label className="mt-4 grid gap-1 text-sm">Sample name<Field value={styleCorpusName} onChange={(event) => setStyleCorpusName(event.target.value)} /></label><label className="mt-3 grid gap-1 text-sm">Paste local sample<TextareaField value={styleCorpusContent} onChange={(event) => setStyleCorpusContent(event.target.value)} /></label><Button type="button" className="mt-3" onClick={() => void addStyleCorpusItem()}>Add local sample</Button>{styleCorpusMessage && <p className="mt-2 text-sm text-muted" aria-live="polite">{styleCorpusMessage}</p>}</section></div> : <div className="m-auto w-full max-w-3xl p-8 text-sm leading-6 text-muted"><h3 className="text-base font-semibold text-ink">{workspaceTabs.find((tab) => tab.id === workspaceTab)?.label}</h3><p className="mt-2">This supporting view is available in the navigation panel and does not change your article automatically.</p><Button type="button" variant="secondary" className="mt-4" onClick={() => setWorkspaceTab("editor")}>Return to editor</Button></div>}
            </> : <EmptyState title="Select an article"><p>Create an article or choose one from the sidebar.</p></EmptyState>}
        </section>
        {selected && <footer className={`fixed inset-x-0 bottom-0 z-20 hidden h-10 items-center border-t border-border bg-surface-raised px-5 text-xs text-muted shadow-[0_-1px_2px_rgb(37_37_33_/_3%)] md:flex ${distractionFree ? "md:left-0" : navigationCollapsed ? "md:left-11" : "md:left-56"} ${distractionFree || assistantCollapsed ? "md:right-0" : "md:right-80"}`} aria-label="Document status">
            <span className={saveState === "error" ? "text-danger" : saveState === "saving" ? "text-warning" : "text-success"}>●</span>
            <span className="ml-2">{saveState === "saving" ? "Saving" : saveState === "error" ? "Save needs attention" : "Saved"}</span>
            <span className="mx-3 text-border-strong">·</span>
            <span>Version {selected.currentVersionId.slice(0, 8)} · {new Date(selected.updatedAt).toLocaleString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="ml-auto">{publishCharacterCount.toLocaleString()} chars</span>
        </footer>}
        {!distractionFree && <aside className={`${assistantCollapsed ? "hidden" : ""} min-w-0 overflow-y-auto border-l border-border bg-surface-raised px-4 py-4`} aria-label="Editorial assistant">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-4"><div><h2 className="text-sm font-semibold">✦&nbsp; AI Assistant</h2><p className="mt-1 text-[0.7rem] text-muted">Suggestions require your approval.</p></div><Button type="button" variant="quiet" className="min-h-8 px-2 py-1" aria-label="Collapse assistant" onClick={toggleAssistantPanel}>›</Button></div>
            <div className="mt-4 rounded-panel bg-brand p-3 text-xs leading-5 text-white"><strong>Flow &amp; clarity review</strong><p className="mt-1 text-white/90">Review this article and suggest improvements to make it more cohesive.</p></div>
            <div className="mt-4 rounded-panel border border-border bg-canvas p-3 text-xs leading-5 text-muted"><strong className="text-ink">Input scope</strong><p className="mt-1">Sends the saved revision {selected ? selected.currentVersionId.slice(0, 8) : "—"} and only the guidance you enter below.</p></div>
            <label className="mt-4 grid gap-1 text-xs text-muted">Editorial guidance<TextareaField value={editorialContext} onChange={(event) => setEditorialContext(event.target.value)} placeholder="Add talking points or revision guidance…" disabled={!selected || editorialState === EditorialState.Streaming} /></label>
            <div className="mt-3 grid gap-2"><Button type="button" variant="secondary" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)} disabled={!selected || editorialState === EditorialState.Streaming}>Connect talking points</Button><Button type="button" variant="secondary" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FLOW_REVISION)} disabled={!selected || editorialState === EditorialState.Streaming}>Improve flow</Button><Button type="button" variant="secondary" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FACT_CHECK)} disabled={!selected || editorialState === EditorialState.Streaming}>Check facts</Button><Button type="button" variant="secondary" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.STYLE_REVIEW)} disabled={!selected || editorialState === EditorialState.Streaming || !styleCorpus?.profile}>Review style</Button><Button type="button" variant="secondary" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.TRANSLATION)} disabled={!selected || editorialState === EditorialState.Streaming || !targetLanguage.trim()}>Translate</Button></div>
            {editorialState === EditorialState.Streaming && <Button type="button" variant="danger" className="mt-3 w-full" onClick={cancelEditorialProposal}>Stop request</Button>}
            {editorialState === EditorialState.Error && lastEditorialOperation && <Button type="button" className="mt-3 w-full" onClick={() => void requestEditorialProposal(lastEditorialOperation)}>Retry request</Button>}
            {editorialMessage && <p className={`mt-3 text-xs leading-5 ${editorialState === EditorialState.Error ? "text-danger" : "text-muted"}`} aria-live="polite">{editorialMessage}</p>}
            <section className="mt-5 border-t border-border pt-4" aria-label="Assistant activity"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</h3><ol className="mt-3 grid gap-3 text-xs leading-5">{assistantHistory.length === 0 ? <li className="text-muted">No requests in this local session.</li> : assistantHistory.map((entry) => <li key={entry.id} className={entry.tone === "error" ? "text-danger" : entry.tone === "success" ? "text-success" : "text-muted"}>{entry.text}<time className="mt-1 block text-[0.7rem] text-muted">{new Date(entry.timestamp).toLocaleTimeString()}</time></li>)}</ol></section>
        </aside>}
        {!distractionFree && assistantCollapsed && <Button type="button" className="fixed bottom-4 right-4 shadow-raised" onClick={toggleAssistantPanel}>Open assistant</Button>}
        <Dialog open={isCreateDialogOpen} aria-labelledby="new-document-title">
            <form method="dialog" className="grid w-[min(32rem,calc(100vw-2rem))] gap-4">
                <div><h2 id="new-document-title" className="text-lg font-semibold">New document</h2><p className="mt-1 text-sm text-muted">Start with an empty draft or save your talking points for a reviewable narrative proposal.</p></div>
                <label className="grid gap-1 text-sm">Title<Field value={newDocumentTitle} onChange={(event) => setNewDocumentTitle(event.target.value)} placeholder="Article title" autoFocus /></label>
                <label className="grid gap-1 text-sm">Talking points <span className="text-xs text-muted">(optional)</span><TextareaField value={newDocumentPoints} onChange={(event) => setNewDocumentPoints(event.target.value)} placeholder="Claims, structure, links, or notes…" /></label>
                <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Source language<Field value={newDocumentLanguage} onChange={(event) => setNewDocumentLanguage(event.target.value)} /></label><label className="grid gap-1 text-sm">Audience <span className="text-xs text-muted">(optional)</span><Field value={newDocumentAudience} onChange={(event) => setNewDocumentAudience(event.target.value)} placeholder="e.g. engineering leaders" /></label></div>
                <label className="grid gap-1 text-sm">Publishing profile<Select value={publishLimitProfileId} onChange={(event) => setPublishLimitProfileId(event.target.value as PublishLimitProfileId)}>{publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</Select></label>
                <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="quiet" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button><Button type="button" variant="secondary" onClick={() => void createDocumentFromFlow(false)}>Create empty draft</Button><Button type="button" disabled={!newDocumentPoints.trim()} onClick={() => void createDocumentFromFlow(true)}>Save talking points</Button></div>
            </form>
        </Dialog>
    </main>;
}

