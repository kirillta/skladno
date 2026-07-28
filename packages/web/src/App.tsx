import { useEffect, useRef, useState } from "react";
import { DocumentConflictError, EDITORIAL_OPERATION, type Document, type EditorialOperation, type EditorialEvent } from "@skladno/shared";
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

    const selected = documents.find((document) => document.id === selectedId);
    const content = selectedId ? drafts[selectedId] ?? "" : "";


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
        setEditorialState(EditorialState.Idle);
        setEditorialMessage("Proposal cancelled. Your article is unchanged.");
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
                {proposal && <output className="proposal">{proposal}</output>}
            </section>
        </aside>
        <section className="editor-pane" aria-label="Article editor">
            {selected ? <><header><h2>{selected.title}</h2><p aria-live="polite" data-state={saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save. Your text is still here." : "Saved locally"}</p>{saveState === "error" && <button type="button" onClick={() => save(selected.id, draftsRef.current[selected.id] ?? "")}>Retry save</button>}</header>
                <textarea aria-label="Article text" value={content} onChange={(event) => { const value = event.target.value; setDrafts((items) => ({ ...items, [selected.id]: value })); }} placeholder="Start writing…" spellCheck />
            </> : <div className="empty editor-empty"><h2>Select an article</h2><p>Create an article or choose one from the sidebar.</p></div>}
        </section>
    </main>;
}
