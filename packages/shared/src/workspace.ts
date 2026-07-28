import type { CreateDocumentInput, Document, DocumentVersion, SaveDocumentDraftInput } from "./persistence/documents.js";

export const documentsPath = "/api/documents";

/** The transport-neutral operations required by the author workspace. */
export interface WorkspaceClient {
    listDocuments(): Promise<Document[]>;
    createDocument(input: CreateDocumentInput): Promise<Document>;
    renameDocument(documentId: string, title: string): Promise<Document>;
    deleteDocument(documentId: string): Promise<void>;
    saveDraft(documentId: string, input: SaveDocumentDraftInput): Promise<DocumentVersion>;
}

export class DocumentConflictError extends Error {
    constructor(public readonly document: Document) {
        super("This article was changed by another save. Reload it and try again.");
        this.name = "DocumentConflictError";
    }
}
