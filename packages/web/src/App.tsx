import { useEffect, useRef, useState } from "react";
import { applyProposalChanges, countPublishingCharacters, createTextProposal, defaultPublishLimitProfileId, DocumentConflictError, EDITORIAL_OPERATION, FACT_CHECK_STATUS, getPublishLimitProfile, preparePlainTextForPublishing, publishLimitProfiles, type Document, type DocumentVersion, type EditorialOperation, type EditorialEvent, type FactCheck, type PublishLimitProfileId, type StyleCorpus, type StyleReview, type TextProposal, type TranslationMetadata } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client";

type WorkspaceState = "loading" | "ready" | "error";
type SaveState = "saved" | "saving" | "error";


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
    editorPane: "flex min-w-0 flex-col [&_header]:flex [&_header]:min-h-[4.6rem] [&_header]:items-center [&_header]:gap-4 [&_header]:border-b [&_header]:border-border [&_header]:px-[clamp(1.5rem,5vw,5rem)] [&_header]:py-4 [&_header_h2]:truncate [&_header_h2]:text-lg [&_header_h2]:font-semibold [&_header_p]:ml-auto [&_header_p]:text-xs [&_header_p]:text-muted [&_header_button]:rounded-md [&_header_button]:bg-brand [&_header_button]:px-2.5 [&_header_button]:py-1.5 [&_header_button]:text-xs [&_header_button]:text-white [&>textarea]:min-h-[65vh] [&>textarea]:w-full [&>textarea]:flex-1 [&>textarea]:resize-none [&>textarea]:bg-transparent [&>textarea]:px-[clamp(1.5rem,12vw,12rem)] [&>textarea]:py-12 [&>textarea]:font-editor [&>textarea]:text-[clamp(1.1rem,1.7vw,1.35rem)] [&>textarea]:leading-[1.7] [&>textarea]:outline-none [&>textarea]:placeholder:text-ink/40",
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
    const publishText = preparePlainTextForPublishing(content);
    const publishCharacterCount = countPublishingCharacters(publishText);
    const publishLimitProfile = getPublishLimitProfile(publishLimitProfileId);


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
        setStyleReview(undefined);
        setFactCheck(undefined);
        setTranslation(undefined);
        setSelectedChanges(new Set());
        setEditorialState(EditorialState.Streaming);
        setLastEditorialOperation(operation);
        setEditorialMessage("Preparing a proposal…");

        try {
            await client.streamEditorial(selected.id, {
                requestId: crypto.randomUUID(),
                operation,
            authorContext: editorialContext,
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
        setStyleReview(undefined);
        setFactCheck(undefined);
        setTranslation(undefined);
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

    return <main className="grid min-h-screen grid-cols-1 bg-canvas font-ui text-ink md:h-screen md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b border-border bg-surface px-3 py-5 md:border-r md:border-b-0" aria-label="Articles">
            <div className="flex items-center justify-between gap-2 px-2 pb-4"><h1>Skladno</h1><button type="button" onClick={createArticle}>New article</button></div>
            {documents.length === 0 ? <p className="p-2 text-sm leading-6 text-muted">No articles yet. Create one to start writing.</p> : <ul className="m-0 list-none space-y-1 p-0">
                {documents.map((document) => <li key={document.id} className={`rounded-md p-0.5 ${document.id === selectedId ? "bg-brand-soft" : ""}`}>
                    {renameId === document.id ? <input autoFocus aria-label="Article title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => void commitRename(document.id)} onKeyDown={(event) => { if (event.key === "Enter") void commitRename(document.id); if (event.key === "Escape") setRenameId(undefined); }} />
                        : <button type="button" className="block w-full truncate rounded px-2 py-2 text-left text-sm hover:bg-white/45" onClick={() => selectArticle(document.id)}>{document.title}{document.language ? <small>{document.language} translation</small> : null}</button>}
                    <div className="flex gap-2 px-2 pb-1"><button type="button" onClick={() => { setRenameId(document.id); setRenameValue(document.title); }}>Rename</button><button type="button" onClick={() => void deleteArticle(document)}>Delete</button></div>
                </li>)}
            </ul>}
            <section className={ui.sidebarSection} aria-label="Publish mode">
                <h2>Publish to LinkedIn</h2>
                <p>Prepare a local plain-text copy. This never saves or changes your article.</p>
                <label>Length guidance
                    <select aria-label="Publishing length profile" value={publishLimitProfileId} onChange={(event) => void selectPublishLimitProfile(event.target.value as PublishLimitProfileId)}>
                        {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} ({profile.characterLimit.toLocaleString()} characters)</option>)}
                    </select>
                </label>
                <p className={`text-xs ${publishCharacterCount > publishLimitProfile.characterLimit ? "text-danger" : publishCharacterCount >= publishLimitProfile.warningThreshold ? "text-caution" : "text-brand"}`} aria-live="polite">
                    {publishCharacterCount.toLocaleString()} / {publishLimitProfile.characterLimit.toLocaleString()} characters
                    {publishCharacterCount > publishLimitProfile.characterLimit ? " — over this profile’s guidance." : publishCharacterCount >= publishLimitProfile.warningThreshold ? " — nearing this profile’s guidance." : " — within this profile’s guidance."}
                </p>
                <button type="button" onClick={() => void copyPublishingText()} disabled={!selected}>Copy plain text</button>
                <p className="publish-format-note">Links are kept as readable text. LinkedIn may not preserve every line break or other formatting exactly after paste.</p>
                <output className="mt-2 block max-h-64 overflow-y-auto rounded-md border border-border bg-canvas p-2 font-editor text-xs leading-5 whitespace-pre-wrap select-text" aria-label="Plain-text publishing preview">{publishText || "Your plain-text preview will appear here."}</output>
                {publishMessage && <p aria-live="polite">{publishMessage}</p>}
            </section>
            <section className={ui.sidebarSection} aria-label="Editorial assistant">
                <h2>Editorial assistant</h2>
                <p>Choose a workflow. Skladno creates a proposal for review and never replaces the saved article.</p>
                <textarea aria-label="Theses or editorial guidance" value={editorialContext} onChange={(event) => setEditorialContext(event.target.value)} placeholder="Add theses, a tone, or revision guidance…" disabled={!selected || editorialState === EditorialState.Streaming} />
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
                    <textarea className={`${ui.field} mt-3 min-h-56 resize-y font-editor leading-6`} aria-label="Translation proposal" value={proposal} onChange={(event) => setProposal(event.target.value)} />
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
                                {change.baseLines.length > 0 && <del>{change.baseLines.join("\n")}</del>}
                                {change.proposalLines.length > 0 && <ins>{change.proposalLines.join("\n")}</ins>}
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
        </aside>
        <section className={ui.editorPane} aria-label="Article editor">
            {selected ? <><header><h2>{selected.title}</h2><p aria-live="polite" data-state={saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save. Your text is still here." : "Saved locally"}</p>{saveState === "error" && <button type="button" onClick={() => save(selected.id, draftsRef.current[selected.id] ?? "")}>Retry save</button>}</header>
                <textarea aria-label="Article text" value={content} onChange={(event) => { const value = event.target.value; setDrafts((items) => ({ ...items, [selected.id]: value })); }} placeholder="Start writing…" spellCheck />
            </> : <div className="m-auto p-2 text-center text-sm leading-6 text-muted"><h2>Select an article</h2><p>Create an article or choose one from the sidebar.</p></div>}
        </section>
    </main>;
}

