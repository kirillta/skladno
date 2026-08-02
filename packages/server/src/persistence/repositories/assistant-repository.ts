import { isBuiltInSkillId, type AssistantMessage, type AssistantMessageKind, type AssistantMessageRole, type AssistantMessageStatus } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, type Row } from "./repository-utils.js";

const roles: readonly AssistantMessageRole[] = ["assistant", "author", "system"];
const kinds: readonly AssistantMessageKind[] = ["greeting", "message", "response", "status"];
const statuses: readonly AssistantMessageStatus[] = ["completed", "pending", "failed", "cancelled"];

export class AssistantRepository {
    constructor(private readonly database: SqliteDatabase) {}

    ensureGreeting(articleId: string): void {
        const exists = this.database.prepare("SELECT 1 FROM assistant_messages WHERE article_id = ? AND kind = 'greeting' LIMIT 1").get(articleId);
        if (exists)
            return;

        const timestamp = now();
        this.database.prepare("INSERT INTO assistant_messages (id, article_id, role, kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(createId(), articleId, "assistant", "greeting", "completed", timestamp, timestamp);
    }

    seedGreetings(): void {
        const articles = this.database.prepare("SELECT id FROM articles").all() as Row[];
        for (const article of articles)
            this.ensureGreeting(String(article.id));
    }

    listMessages(articleId: string): AssistantMessage[] {
        this.ensureGreeting(articleId);
        const rows = this.database.prepare("SELECT * FROM assistant_messages WHERE article_id = ? ORDER BY created_at, id").all(articleId) as Row[];

        return rows.map((row) => this.toMessage(row));
    }

    private toMessage(row: Row): AssistantMessage {
        const role = String(row.role) as AssistantMessageRole;
        const kind = String(row.kind) as AssistantMessageKind;
        const status = String(row.status) as AssistantMessageStatus;
        if (!roles.includes(role) || !kinds.includes(kind) || !statuses.includes(status))
            throw new Error("Invalid persisted assistant message.");

        const skillId = row.skill_id === null ? undefined : String(row.skill_id);
        if (skillId !== undefined && !isBuiltInSkillId(skillId))
            throw new Error("Invalid persisted assistant skill.");

        return {
            id: String(row.id), articleId: String(row.article_id), ...(row.request_id === null ? {} : { requestId: String(row.request_id) }), role, kind, status,
            ...(row.content === null ? {} : { content: String(row.content) }), ...(kind === "greeting" ? { template: "greeting" as const } : {}), ...(skillId === undefined ? {} : { skillId }),
            ...(row.response_kind === null ? {} : { responseKind: String(row.response_kind) as AssistantMessage["responseKind"] }),
            ...(row.editorial_artifact_id === null ? {} : { editorialArtifactId: String(row.editorial_artifact_id) }), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
        };
    }
}
