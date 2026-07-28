import { useEffect, useRef, useState } from "react";
import { DocumentConflictError, type Document } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client";

type WorkspaceState = "loading" | "ready" | "error";
type SaveState = "saved" | "saving" | "error";

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

  function save(documentId: string, draft: string) {
    setSaveState("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      const baseVersionId = versions.current.get(documentId);
      if (!baseVersionId) return;
      try {
        const version = await client.saveDraft(documentId, { content: draft, baseVersionId });
        updateSavedVersion(documentId, version.id, version.content);
        if (selectedRef.current === documentId) setSaveState("saved");
      } catch (error) {
        if (error instanceof DocumentConflictError) {
          versions.current.set(documentId, error.document.currentVersionId);
          setDocuments((items) => items.map((item) => item.id === documentId ? error.document : item));
        }
        if (selectedRef.current === documentId) setSaveState("error");
      }
    });
  }

  function selectArticle(documentId: string) {
    if (selected && selected.id !== documentId) {
      const currentDraft = draftsRef.current[selected.id] ?? "";
      if (currentDraft !== selected.currentVersion.content) save(selected.id, currentDraft);
    }
    setSelectedId(documentId);
  }

  useEffect(() => {
    if (!selectedId || state !== "ready") return;
    const savedContent = selected?.currentVersion.content;
    if (content === savedContent) return;
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
    if (!title) return;
    try {
      const renamed = await client.renameDocument(documentId, title);
      setDocuments((items) => items.map((item) => item.id === documentId ? renamed : item));
    } catch { setSaveState("error"); }
  }

  async function deleteArticle(document: Document) {
    if (!window.confirm(`Delete “${document.title}”? This removes its saved draft and history.`)) return;
    try {
      await client.deleteDocument(document.id);
      versions.current.delete(document.id);
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      setDrafts((items) => { const { [document.id]: _, ...remaining } = items; return remaining; });
      if (selectedId === document.id) setSelectedId(documents.find((item) => item.id !== document.id)?.id);
    } catch { setSaveState("error"); }
  }

  if (state !== "ready") return <main className="startup"><h1>Skladno</h1><p aria-live="polite" data-state={state}>{message}</p></main>;

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
    </aside>
    <section className="editor-pane" aria-label="Article editor">
      {selected ? <><header><h2>{selected.title}</h2><p aria-live="polite" data-state={saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save. Your text is still here." : "Saved locally"}</p>{saveState === "error" && <button type="button" onClick={() => save(selected.id, draftsRef.current[selected.id] ?? "")}>Retry save</button>}</header>
        <textarea aria-label="Article text" value={content} onChange={(event) => { const value = event.target.value; setDrafts((items) => ({ ...items, [selected.id]: value })); }} placeholder="Start writing…" spellCheck />
      </> : <div className="empty editor-empty"><h2>Select an article</h2><p>Create an article or choose one from the sidebar.</p></div>}
    </section>
  </main>;
}
