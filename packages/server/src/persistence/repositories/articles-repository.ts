import { WORKFLOW_STAGE, isArticleLanguage, isPublishLimitProfileId, isWorkflowStage, type AcceptedChange, type AcceptProposalInput, type CreateArticleInput, type UpdateArticleInput, type Article, type ArticleRevision, type SaveArticleRevisionInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { ArticleRevisionConflictError } from "../errors.js";
import { createId, now, parseObject, required, type Row } from "./repository-utils.js";


function revision(row: Row): ArticleRevision {
    return {
        id: String(row.id),
        articleId: String(row.article_id),
        content: String(row.content),
        createdAt: String(row.created_at),
        provenance: parseObject(row.provenance_json),
        ...(row.restored_from_revision_id ? { restoredFromRevisionId: String(row.restored_from_revision_id) } : {}),
    };
}


function article(row: Row): Article {
    const currentRevision = revision(row);
    return {
        id: String(row.article_id),
        title: String(row.title),
        createdAt: String(row.article_created_at),
        updatedAt: String(row.article_updated_at),
        currentRevisionId: currentRevision.id,
        currentRevision,
        workflowStage: String(row.workflow_stage) as Article["workflowStage"],
        ...(row.language ? { language: String(row.language) } : {}),
        ...(row.audience ? { audience: String(row.audience) } : {}),
        ...(row.publishing_profile_id ? { publishingProfileId: String(row.publishing_profile_id) } : {}),
        ...(row.source_article_id ? { sourceArticleId: String(row.source_article_id) } : {}),
        ...(row.source_revision_id ? { sourceRevisionId: String(row.source_revision_id) } : {}),
    };
}


export class ArticlesRepository {
    constructor(private readonly database: SqliteDatabase) { }

    create(input: CreateArticleInput): Article {
        if (input.workflowStage !== undefined && !isWorkflowStage(input.workflowStage))
            throw new Error("Invalid workflow stage.");

        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            throw new Error("Invalid Article language.");

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            throw new Error("Unsupported publishing profile.");

        const timestamp = now();
        const articleId = input.id ?? createId();
        const revisionId = createId();
        const sourceArticleId = input.sourceArticleId;
        if (input.sourceRevisionId && (!sourceArticleId || !this.database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(input.sourceRevisionId, sourceArticleId)))
            throw new Error("Source Revision does not belong to the source Article.");

        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.database.prepare("INSERT INTO articles (id, title, language, audience, publishing_profile_id, source_article_id, source_revision_id, workflow_stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(articleId, required(input.title, "Article title"), language ?? null, input.audience ?? null, input.publishingProfileId ?? null, sourceArticleId ?? null, input.sourceRevisionId ?? null, input.workflowStage ?? WORKFLOW_STAGE.TALKING_POINTS, timestamp, timestamp);
            this.database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)")
                .run(revisionId, articleId, input.content, JSON.stringify(input.provenance ?? { kind: "initial" }), timestamp);
            this.database.prepare("UPDATE articles SET current_revision_id = ? WHERE id = ?").run(revisionId, articleId);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.get(articleId)!;
    }


    list(): Article[] {
        return (this.database.prepare("SELECT a.id article_id, a.title, a.language, a.audience, a.publishing_profile_id, a.source_article_id, a.source_revision_id, a.workflow_stage, a.created_at article_created_at, a.updated_at article_updated_at, r.* FROM articles a JOIN article_revisions r ON r.id = a.current_revision_id ORDER BY a.updated_at DESC, a.id ASC").all() as Row[]).map(article);
    }


    get(articleId: string): Article | undefined {
        const row = this.database.prepare("SELECT a.id article_id, a.title, a.language, a.audience, a.publishing_profile_id, a.source_article_id, a.source_revision_id, a.workflow_stage, a.created_at article_created_at, a.updated_at article_updated_at, r.* FROM articles a JOIN article_revisions r ON r.id = a.current_revision_id WHERE a.id = ?").get(articleId) as Row | undefined;
        return row && article(row);
    }


    update(articleId: string, input: UpdateArticleInput): Article {
        if (!this.get(articleId))
            throw new Error("Article not found.");

        if (input.workflowStage !== undefined && !isWorkflowStage(input.workflowStage))
            throw new Error("Invalid workflow stage.");

        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            throw new Error("Invalid Article language.");

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            throw new Error("Unsupported publishing profile.");

        const assignments: string[] = [];
        const values: string[] = [];

        if (input.title !== undefined) {
            assignments.push("title = ?");
            values.push(required(input.title, "Article title"));
        }

        if (input.workflowStage !== undefined) {
            assignments.push("workflow_stage = ?");
            values.push(input.workflowStage);
        }

        if (language !== undefined) {
            assignments.push("language = ?");
            values.push(language);
        }

        if (input.publishingProfileId !== undefined) {
            assignments.push("publishing_profile_id = ?");
            values.push(input.publishingProfileId);
        }

        assignments.push("updated_at = ?");
        values.push(now(), articleId);
        this.database.prepare(`UPDATE articles SET ${assignments.join(", ")} WHERE id = ?`).run(...values);

        return this.get(articleId)!;
    }


    delete(articleId: string): void {
        if (this.database.prepare("DELETE FROM articles WHERE id = ?").run(articleId).changes === 0)
            throw new Error("Article not found.");
    }


    listRevisions(articleId: string): ArticleRevision[] {
        return (this.database.prepare("SELECT * FROM article_revisions WHERE article_id = ? ORDER BY created_at ASC, id ASC").all(articleId) as Row[]).map(revision);
    }


    acceptChange(articleId: string, change: AcceptedChange): ArticleRevision {
        return this.appendRevision(articleId, change.content, change.provenance);
    }


    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision {
        const current = this.get(articleId);
        if (!current)
            throw new Error("Article not found.");

        const baseRevisionId = input.baseRevisionId;
        if (current.currentRevisionId !== baseRevisionId)
            throw new ArticleRevisionConflictError(current);

        return this.appendRevision(articleId, input.content, input.provenance);
    }


    saveRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision {
        const current = this.get(articleId);
        if (!current)
            throw new Error("Article not found.");

        if (current.currentRevisionId !== input.baseRevisionId)
            throw new ArticleRevisionConflictError(current);

        return this.appendRevision(articleId, input.content, { kind: "author-draft", baseRevisionId: input.baseRevisionId });
    }


    restoreRevision(articleId: string, historicalRevisionId: string): ArticleRevision {
        const historical = this.database.prepare("SELECT * FROM article_revisions WHERE id = ? AND article_id = ?").get(historicalRevisionId, articleId) as Row | undefined;
        if (!historical)
            throw new Error("Revision not found for this article.");

        return this.appendRevision(articleId, String(historical.content), { kind: "restore", restoredFromRevisionId: historicalRevisionId }, historicalRevisionId);
    }


    private appendRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision {
        if (!this.get(articleId))
            throw new Error("Article not found.");

        const revisionId = createId();
        const timestamp = now();

        required(JSON.stringify(provenance), "Change provenance");
        this.database.exec("BEGIN IMMEDIATE;");

        try {
            this.database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, restored_from_revision_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(revisionId, articleId, content, JSON.stringify(provenance), restoredFromRevisionId ?? null, timestamp);

            this.database.prepare("UPDATE articles SET current_revision_id = ?, updated_at = ? WHERE id = ?")
                .run(revisionId, timestamp, articleId);

            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.listRevisions(articleId).find((item) => item.id === revisionId)!;
    }
}
