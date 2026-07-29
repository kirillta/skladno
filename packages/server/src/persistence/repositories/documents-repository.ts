import type { AcceptedChange, AcceptProposalInput, CreateDocumentInput, Document, DocumentVersion, SaveDocumentDraftInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { DocumentConflictError } from "../errors.js";
import { createId, now, parseObject, required, type Row } from "./repository-utils.js";


function version(row: Row): DocumentVersion {
    return {
        id: String(row.id),
        documentId: String(row.document_id),
        content: String(row.content),
        createdAt: String(row.created_at),
        provenance: parseObject(row.provenance_json),
        ...(row.restored_from_version_id ? { restoredFromVersionId: String(row.restored_from_version_id) } : {}),
    };
}


function document(row: Row): Document {
    const currentVersion = version(row);
    return {
        id: String(row.document_id),
        title: String(row.title),
        createdAt: String(row.document_created_at),
        updatedAt: String(row.document_updated_at),
        currentVersionId: currentVersion.id,
        currentVersion,
        ...(row.language ? { language: String(row.language) } : {}),
        ...(row.source_document_id ? { sourceDocumentId: String(row.source_document_id) } : {}),
    };
}


export class DocumentsRepository {
    constructor(private readonly database: SqliteDatabase) { }

    create(input: CreateDocumentInput): Document {
        const timestamp = now();
        const documentId = input.id ?? createId();
        const versionId = createId();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.database.prepare("INSERT INTO documents (id, title, language, source_document_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(documentId, required(input.title, "Document title"), input.language ?? null, input.sourceDocumentId ?? null, timestamp, timestamp);
            this.database.prepare("INSERT INTO document_versions (id, document_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)")
                .run(versionId, documentId, input.content, JSON.stringify(input.provenance ?? { kind: "initial" }), timestamp);
            this.database.prepare("UPDATE documents SET current_version_id = ? WHERE id = ?").run(versionId, documentId);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
        return this.get(documentId)!;
    }


    list(): Document[] {
        return (this.database.prepare("SELECT d.id document_id, d.title, d.language, d.source_document_id, d.created_at document_created_at, d.updated_at document_updated_at, v.* FROM documents d JOIN document_versions v ON v.id = d.current_version_id ORDER BY d.updated_at DESC, d.id ASC").all() as Row[]).map(document);
    }


    get(documentId: string): Document | undefined {
        const row = this.database.prepare("SELECT d.id document_id, d.title, d.language, d.source_document_id, d.created_at document_created_at, d.updated_at document_updated_at, v.* FROM documents d JOIN document_versions v ON v.id = d.current_version_id WHERE d.id = ?").get(documentId) as Row | undefined;
        return row && document(row);
    }


    rename(documentId: string, title: string): Document {
        if (!this.get(documentId))
            throw new Error("Document not found.");

        this.database.prepare("UPDATE documents SET title = ?, updated_at = ? WHERE id = ?")
            .run(required(title, "Document title"), now(), documentId);
       
        return this.get(documentId)!;
    }


    delete(documentId: string): void {
        if (this.database.prepare("DELETE FROM documents WHERE id = ?").run(documentId).changes === 0)
            throw new Error("Document not found.");
    }


    listVersions(documentId: string): DocumentVersion[] {
        return (this.database.prepare("SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at ASC, id ASC").all(documentId) as Row[]).map(version);
    }


    acceptChange(documentId: string, change: AcceptedChange): DocumentVersion {
        return this.appendVersion(documentId, change.content, change.provenance);
    }


    acceptProposal(documentId: string, input: AcceptProposalInput): DocumentVersion {
        const current = this.get(documentId);
        if (!current)
            throw new Error("Document not found.");

        if (current.currentVersionId !== input.baseVersionId)
            throw new DocumentConflictError(current);

        return this.appendVersion(documentId, input.content, input.provenance);
    }


    saveDraft(documentId: string, input: SaveDocumentDraftInput): DocumentVersion {
        const current = this.get(documentId);
        if (!current)
            throw new Error("Document not found.");

        if (current.currentVersionId !== input.baseVersionId)
            throw new DocumentConflictError(current);

        return this.appendVersion(documentId, input.content, { kind: "author-draft", baseVersionId: input.baseVersionId });
    }


    restoreVersion(documentId: string, historicalVersionId: string): DocumentVersion {
        const historical = this.database.prepare("SELECT * FROM document_versions WHERE id = ? AND document_id = ?").get(historicalVersionId, documentId) as Row | undefined;
        if (!historical)
            throw new Error("Version not found for this document.");

        return this.appendVersion(documentId, String(historical.content), { kind: "restore", restoredFromVersionId: historicalVersionId }, historicalVersionId);
    }


    private appendVersion(documentId: string, content: string, provenance: Record<string, unknown>, restoredFromVersionId?: string): DocumentVersion {
        if (!this.get(documentId))
            throw new Error("Document not found.");

        const versionId = createId();
        const timestamp = now();

        required(JSON.stringify(provenance), "Change provenance");
        this.database.exec("BEGIN IMMEDIATE;");

        try {
            this.database.prepare("INSERT INTO document_versions (id, document_id, content, provenance_json, restored_from_version_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(versionId, documentId, content, JSON.stringify(provenance), restoredFromVersionId ?? null, timestamp);
            
            this.database.prepare("UPDATE documents SET current_version_id = ?, updated_at = ? WHERE id = ?")
                .run(versionId, timestamp, documentId);
            
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.listVersions(documentId).find((item) => item.id === versionId)!;
    }
}
