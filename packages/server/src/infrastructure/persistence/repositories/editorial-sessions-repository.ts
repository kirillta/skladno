import type { EditorialSession } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { now, type Row } from "./repository-utils.js";


export class EditorialSessionsRepository {
    constructor(private readonly database: SqliteDatabase, private readonly articleExists: (articleId: string) => boolean) { }


    get(articleId: string): EditorialSession | undefined {
        const row = this.database
            .prepare("SELECT article_id, previous_response_id, connection_id, provider, model, updated_at FROM editorial_sessions WHERE article_id = ?")
            .get(articleId) as Row | undefined;

        return row && {
            articleId: String(row.article_id),
            ...(typeof row.previous_response_id === "string" ? { continuationToken: row.previous_response_id } : {}),
            ...(typeof row.connection_id === "string" ? { connectionId: row.connection_id } : {}),
            ...(row.provider === "openai" || row.provider === "opencode" || row.provider === "anthropic" || row.provider === "google" || row.provider === "xai" || row.provider === "deepseek"
                ? { provider: row.provider }
                : {}
            ),
            ...(typeof row.model === "string" ? { model: row.model } : {}),
            updatedAt: String(row.updated_at),
        };
    }


    save(articleId: string, session: Pick<EditorialSession, "continuationToken" | "connectionId" | "provider" | "model">): EditorialSession {
        if (!this.articleExists(articleId))
            throw new Error("Article not found.");

        const updatedAt = now();
        this.database.prepare("INSERT INTO editorial_sessions (article_id, previous_response_id, connection_id, provider, model, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET previous_response_id = excluded.previous_response_id, connection_id = excluded.connection_id, provider = excluded.provider, model = excluded.model, updated_at = excluded.updated_at")
            .run(articleId, session.continuationToken ?? "", session.connectionId ?? null, session.provider ?? null, session.model ?? null, updatedAt);

        return { articleId, ...session, updatedAt };
    }


    remove(articleId: string): void {
        this.database.prepare("DELETE FROM editorial_sessions WHERE article_id = ?")
            .run(articleId);
    }
}
