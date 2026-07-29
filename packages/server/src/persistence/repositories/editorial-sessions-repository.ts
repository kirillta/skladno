import type { EditorialSession } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { now, type Row } from "./repository-utils.js";


export class EditorialSessionsRepository {
    constructor(private readonly database: SqliteDatabase, private readonly documentExists: (documentId: string) => boolean) { }


    get(documentId: string): EditorialSession | undefined {
        const row = this.database
            .prepare("SELECT document_id, previous_response_id, updated_at FROM editorial_sessions WHERE document_id = ?")
            .get(documentId) as Row | undefined;
        
        return row && { documentId: String(row.document_id), previousResponseId: String(row.previous_response_id), updatedAt: String(row.updated_at) };
    }

    
    save(documentId: string, previousResponseId: string): EditorialSession {
        if (!this.documentExists(documentId))
            throw new Error("Document not found.");
        
        const updatedAt = now();
        this.database.prepare("INSERT INTO editorial_sessions (document_id, previous_response_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(document_id) DO UPDATE SET previous_response_id = excluded.previous_response_id, updated_at = excluded.updated_at")
            .run(documentId, previousResponseId, updatedAt);
        
        return { documentId, previousResponseId, updatedAt };
    }


    remove(documentId: string): void {
        this.database.prepare("DELETE FROM editorial_sessions WHERE document_id = ?")
            .run(documentId);
    }
}
