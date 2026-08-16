import { REVISION_PROVENANCE_KIND, isArticleLanguage, isPublishLimitProfileId, type AcceptedChange, type AcceptProposalInput, type CreateArticleInput, type UpdateArticleInput, type Article, type ArticleDraft, type ArticleRevision, type SaveArticleDraftInput, type SaveArticleRevisionInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { ArticleDraftConflictError } from "../../../application/errors/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../../../application/errors/article-revision-conflict-error.js";
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


function draft(row: Row): ArticleDraft | undefined {
    if (!row.draft_article_id)
        return undefined;

    return {
        articleId: String(row.draft_article_id),
        content: String(row.draft_content),
        baseRevisionId: String(row.draft_base_revision_id),
        version: Number(row.draft_version),
        updatedAt: String(row.draft_updated_at),
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
        ...(draft(row) ? { draft: draft(row) } : {}),
        ...(row.language ? { language: String(row.language) } : {}),
        ...(row.audience ? { audience: String(row.audience) } : {}),
        ...(row.publishing_profile_id ? { publishingProfileId: String(row.publishing_profile_id) } : {}),
        ...(row.source_article_id ? { sourceArticleId: String(row.source_article_id) } : {}),
        ...(row.source_revision_id ? { sourceRevisionId: String(row.source_revision_id) } : {}),
        ...(row.source_revision_number ? { sourceRevisionNumber: Number(row.source_revision_number) } : {}),
    };
}


const articleSelect = "SELECT a.id article_id, a.title, a.language, a.audience, a.publishing_profile_id, a.source_article_id, a.source_revision_id, (SELECT COUNT(*) FROM article_revisions numbered JOIN article_revisions linked ON linked.id = a.source_revision_id WHERE numbered.article_id = a.source_article_id AND (numbered.created_at < linked.created_at OR (numbered.created_at = linked.created_at AND numbered.id <= linked.id))) source_revision_number, a.created_at article_created_at, a.updated_at article_updated_at, r.*, d.article_id draft_article_id, d.content draft_content, d.base_revision_id draft_base_revision_id, d.version draft_version, d.updated_at draft_updated_at FROM articles a JOIN article_revisions r ON r.id = a.current_revision_id LEFT JOIN article_drafts d ON d.article_id = a.id";


export class ArticlesRepository {
    constructor(private readonly database: SqliteDatabase) { }


    create(input: CreateArticleInput): Article {

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
            this.database.prepare("INSERT INTO articles (id, title, language, audience, publishing_profile_id, source_article_id, source_revision_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(articleId, required(input.title, "Article title"), language ?? null, input.audience ?? null, input.publishingProfileId ?? null, sourceArticleId ?? null, input.sourceRevisionId ?? null, timestamp, timestamp);
            this.database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)")
                .run(revisionId, articleId, input.content, JSON.stringify(input.provenance ?? { kind: REVISION_PROVENANCE_KIND.INITIAL }), timestamp);
            this.database.prepare("UPDATE articles SET current_revision_id = ? WHERE id = ?").run(revisionId, articleId);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.get(articleId)!;
    }


    list(): Article[] {
        return (this.database.prepare(`${articleSelect} ORDER BY CASE WHEN d.updated_at IS NOT NULL AND d.updated_at > a.updated_at THEN d.updated_at ELSE a.updated_at END DESC, a.id ASC`).all() as Row[]).map(article);
    }


    get(articleId: string): Article | undefined {
        const row = this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row | undefined;
        return row && article(row);
    }


    update(articleId: string, input: UpdateArticleInput): Article {
        if (!this.get(articleId))
            throw new Error("Article not found.");


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


    getRevision(articleId: string, revisionId: string): ArticleRevision | undefined {
        const row = this.database.prepare("SELECT * FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId) as Row | undefined;

        return row && revision(row);
    }


    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                throw new Error("Article not found.");

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            const existing = current.draft;
            if (existing?.version !== input.expectedDraftVersion)
                throw new ArticleDraftConflictError(current, existing);

            const timestamp = now();
            const version = (existing?.version ?? 0) + 1;
            this.database.prepare("INSERT INTO article_drafts (article_id, content, base_revision_id, version, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET content = excluded.content, base_revision_id = excluded.base_revision_id, version = excluded.version, updated_at = excluded.updated_at")
                .run(articleId, input.content, input.baseRevisionId, version, timestamp);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.get(articleId)!.draft!;
    }


    discardDraft(articleId: string, expectedDraftVersion: number): void {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                throw new Error("Article not found.");

            if (current.draft?.version !== expectedDraftVersion)
                throw new ArticleDraftConflictError(current, current.draft);

            this.database.prepare("DELETE FROM article_drafts WHERE article_id = ? AND version = ?")
                .run(articleId, expectedDraftVersion);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
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
        const revisionId = createId();
        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                throw new Error("Article not found.");

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            if (current.draft?.version !== input.expectedDraftVersion)
                throw new ArticleDraftConflictError(current, current.draft);

            if (current.draft && current.draft.content !== input.content)
                throw new ArticleDraftConflictError(current, current.draft);

            const provenance = { kind: REVISION_PROVENANCE_KIND.AUTHOR_DRAFT, baseRevisionId: input.baseRevisionId };
            this.database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)")
                .run(revisionId, articleId, input.content, JSON.stringify(provenance), timestamp);
            this.database.prepare("UPDATE articles SET current_revision_id = ?, updated_at = ? WHERE id = ?")
                .run(revisionId, timestamp, articleId);

            if (current.draft)
                this.database.prepare("DELETE FROM article_drafts WHERE article_id = ? AND version = ?")
                    .run(articleId, current.draft.version);

            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.listRevisions(articleId).find((item) => item.id === revisionId)!;
    }


    restoreRevision(articleId: string, historicalRevisionId: string): ArticleRevision {
        const historical = this.getRevision(articleId, historicalRevisionId);
        if (!historical)
            throw new Error("Revision not found for this article.");

        return this.appendRevision(articleId, historical.content, { kind: REVISION_PROVENANCE_KIND.RESTORE, restoredFromRevisionId: historicalRevisionId }, historicalRevisionId);
    }


    appendRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision {
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
