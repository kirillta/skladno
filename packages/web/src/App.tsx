import { useEffect, useRef, useState } from "react";
import { applyProposalChanges, createTextProposal, DocumentConflictError, EDITORIAL_OPERATION, type Document, type DocumentVersion, type EditorialOperation, type EditorialEvent, type TextProposal } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client";

type WorkspaceState = "loading" | "ready" | "error";
type SaveState = "saved" | "saving" | "error";


enum EditorialState {
    Idle = "idle",
    Streaming = "streaming",
    Error = "error",
}


const client = new HttpApplicationClient();


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


    async function requestEditorialProposal(operation: EditorialOperation) {
        if (!selected)
            return;

        const draft = draftsRef.current[selected.id] ?? "";
        if (draft !== selected.currentVersion.content) {
            const saved = await save(selected.id, draft);
            if (!saved) {
                setEditorialState(EditorialState.Error);
                setEditorialMessage("Couldn’t save the current article, so no text was sent for review. Retry saving, then try again.");

                return;
            }
        }

        const controller = new AbortController();
        editorialRequest.current = controller;
        setProposal("");
        setProposalBase({ content: draft, versionId: versions.current.get(selected.id)! });
        setProposalResponseId(undefined);
        setSelectedChanges(new Set());
        setEditorialState(EditorialState.Streaming);
        setLastEditorialOperation(operation);
        setEditorialMessage("Preparing a proposal…");

        try {
            await client.streamEditorial(selected.id, {
                requestId: crypto.randomUUID(),
                operation,
                authorContext: editorialContext,
            }, (event: EditorialEvent) => {
                if (event.type === "text_delta") {
                    setProposal((current) => current + event.delta);
                    setEditorialMessage("Writing proposal…");
                } else if (event.type === "tool_status") {
                    setEditorialMessage(`${event.status === "started" ? "Using" : "Finished"} ${event.tool.replace("_", " ")}.`);
                } else if (event.type === "completed") {
                    setProposal(event.text);
                    setProposalResponseId(event.responseId);
                    setEditorialState(EditorialState.Idle);
                    setEditorialMessage("Proposal ready for review. It has not changed your article.");
                } else {
                    setEditorialState(EditorialState.Error);
                    setEditorialMessage(event.message);
                }
            }, controller.signal);
        } catch (error) {
            if (!controller.signal.aborted) {
                setEditorialState(EditorialState.Error);
                setEditorialMessage(error instanceof Error ? error.message : "Couldn’t get a proposal. Retry when ready.");
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
        setEditorialState(EditorialState.Idle);
        setEditorialMessage("Proposal cancelled. Your article is unchanged.");
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
            setEditorialMessage("Accepted changes were saved as a new version.");
            loadHistory(selected.id);
        } catch (error) {
            setEditorialState(EditorialState.Error);
            setEditorialMessage(error instanceof Error ? `${error.message} Review the proposal again against the current article.` : "Couldn’t accept this proposal.");
        }
    }


    function rejectProposal() {
        setProposal("");
        setProposalBase(undefined);
        setSelectedChanges(new Set());
        setEditorialMessage("Proposal rejected. Your article is unchanged.");
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

    
    if (state !== "ready") 
        return <main className="startup"><h1>Skladno</h1><p aria-live="polite" data-state={state}>{message}</p></main>;

    return <main className="workspace">
        <aside aria-label="Articles">
            <div className="sidebar-heading"><h1>Skladno</h1><button type="button" onClick={createArticle}>New article</button></div>
            {documents.length === 0 ? <p className="empty">No articles yet. Create one to start writing.</p> : <ul className="article-list">
                {documents.map((document) => <li key={document.id} className={document.id === selectedId ? "selected" : ""}>
                    {renameId === document.id ? <input autoFocus aria-label="Article title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename(document.id)} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(document.id); if (event.key === "Escape") setRenameId(undefined); }} />
                        : <button type="button" className="article" onClick={() => selectArticle(document.id)}>{document.title}</button>}
                    <div className="article-actions"><button type="button" onClick={() => { setRenameId(document.id); setRenameValue(document.title); }}>Rename</button><button type="button" onClick={() => void deleteArticle(document)}>Delete</button></div>
                </li>)}
            </ul>}
            <section className="editorial-assistant" aria-label="Editorial assistant">
                <h2>Editorial assistant</h2>
                <p>Choose a workflow. Skladno creates a proposal for review and never replaces the saved article.</p>
                <textarea aria-label="Theses or editorial guidance" value={editorialContext} onChange={(event) => setEditorialContext(event.target.value)} placeholder="Add theses, a tone, or revision guidance…" disabled={!selected || editorialState === EditorialState.Streaming} />
                <div className="editorial-actions">
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.THESIS_TO_NARRATIVE)} disabled={!selected || editorialState === EditorialState.Streaming}>Turn theses into narrative</button>
                    <button type="button" onClick={() => void requestEditorialProposal(EDITORIAL_OPERATION.FLOW_REVISION)} disabled={!selected || editorialState === EditorialState.Streaming}>Revise draft for flow</button>
                    {editorialState === EditorialState.Streaming && <button type="button" onClick={cancelEditorialProposal}>Cancel</button>}
                    {editorialState === EditorialState.Error && lastEditorialOperation && <button type="button" onClick={() => void requestEditorialProposal(lastEditorialOperation)}>Retry request</button>}
                </div>
                {editorialMessage && <p data-state={editorialState === EditorialState.Error ? "error" : undefined} aria-live="polite">{editorialMessage}</p>}
                {proposal && review && proposalResponseId && editorialState === EditorialState.Idle && <section className="proposal-review" aria-label="Proposal review">
                    <h3>Review proposal</h3>
                    {review.changes.length === 0 ? <p>This proposal has no text changes. Your article is unchanged.</p> : <>
                        <p>Select the changes to accept. The proposal is compared with the saved version that was sent for review.</p>
                        <div className="proposal-changes">
                            {review.changes.map((change, index) => <label key={change.id} className="proposal-change">
                                <input type="checkbox" checked={selectedChanges.has(change.id)} onChange={() => toggleProposalChange(change.id)} />
                                <span>Change {index + 1}</span>
                                {change.baseLines.length > 0 && <del>{change.baseLines.join("\n")}</del>}
                                {change.proposalLines.length > 0 && <ins>{change.proposalLines.join("\n")}</ins>}
                            </label>)}
                        </div>
                        <div className="editorial-actions">
                            <button type="button" onClick={() => void acceptProposal()} disabled={selectedChanges.size === 0}>Accept selected</button>
                            <button type="button" onClick={() => void acceptProposal(new Set(review.changes.map((change) => change.id)))}>Accept whole proposal</button>
                            <button type="button" className="secondary-action" onClick={rejectProposal}>Reject proposal</button>
                        </div>
                    </>}
                </section>}
            </section>
            {selected && <section className="version-history" aria-label="Version history">
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
        </aside>
        <section className="editor-pane" aria-label="Article editor">
            {selected ? <><header><h2>{selected.title}</h2><p aria-live="polite" data-state={saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save. Your text is still here." : "Saved locally"}</p>{saveState === "error" && <button type="button" onClick={() => save(selected.id, draftsRef.current[selected.id] ?? "")}>Retry save</button>}</header>
                <textarea aria-label="Article text" value={content} onChange={(event) => { const value = event.target.value; setDrafts((items) => ({ ...items, [selected.id]: value })); }} placeholder="Start writing…" spellCheck />
            </> : <div className="empty editor-empty"><h2>Select an article</h2><p>Create an article or choose one from the sidebar.</p></div>}
        </section>
    </main>;
}
