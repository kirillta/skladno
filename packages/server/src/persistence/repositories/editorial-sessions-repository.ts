import type { EditorialSession } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { now, type Row } from "./repository-utils.js";


export class EditorialSessionsRepository {
    constructor(private readonly database: SqliteDatabase, private readonly articleExists: (articleId: string) => boolean) { }


    get(articleId: string): EditorialSession | undefined {
        const row = this.database
            .prepare("SELECT article_id, previous_response_id, updated_at FROM editorial_sessions WHERE article_id = ?")
            .get(articleId) as Row | undefined;
        
        return row && { articleId: String(row.article_id), previousResponseId: String(row.previous_response_id), updatedAt: String(row.updated_at) };
    }

    
    save(articleId: string, previousResponseId: string): EditorialSession {
        if (!this.articleExists(articleId))
            throw new Error("Article not found.");
        
        const updatedAt = now();
        this.database.prepare("INSERT INTO editorial_sessions (article_id, previous_response_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET previous_response_id = excluded.previous_response_id, updated_at = excluded.updated_at")
            .run(articleId, previousResponseId, updatedAt);
        
        return { articleId, previousResponseId, updatedAt };
    }


    remove(articleId: string): void {
        this.database.prepare("DELETE FROM editorial_sessions WHERE article_id = ?")
            .run(articleId);
    }
}
