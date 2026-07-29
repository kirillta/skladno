export interface DocumentVersion {
    id: string;
    documentId: string;
    content: string;
    createdAt: string;
    provenance: Record<string, unknown>;
    restoredFromVersionId?: string;
}


export interface Document {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    currentVersionId: string;
    currentVersion: DocumentVersion;
    language?: string;
    sourceDocumentId?: string;
}


export interface CreateDocumentInput {
    id?: string;
    title: string;
    content: string;
    provenance?: Record<string, unknown>;
    language?: string;
    sourceDocumentId?: string;
}


/** A compare-and-swap draft write. A conflict means another writer saved first. */
export interface SaveDocumentDraftInput {
    content: string;
    baseVersionId: string;
}


export interface AcceptedChange {
    content: string;
    provenance: Record<string, unknown>;
}
