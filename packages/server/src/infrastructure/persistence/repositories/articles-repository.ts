import { REVISION_PROVENANCE_KIND, isArticleLanguage, isPublishLimitProfileId, type AcceptedChange, type AcceptProposalInput, type CreateArticleInput, type UpdateArticleInput, type Article, type ArticleDraft, type ArticleRevision, type SaveArticleDraftInput, type SaveArticleRevisionInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { ArticleDraftConflictError } from "../../../application/errors/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../../../application/errors/article-revision-conflict-error.js";
import { deleteArticle, reorderPinnedArticles, setArticleArchived, setArticlePinned } from "./article-library-repository.js";
import { articleNotFound, invalidArticleRequest, requireArticleTitle, revisionNotFound, unsupportedPublishingProfile } from "./article-repository-errors.js";
import { articleFromRow, articleSelect } from "./article-repository-records.js";
import { getArticleRevision, insertArticleRevision, listArticleRevisions } from "./article-repository-revisions.js";
import { createId, now, type Row } from "./repository-utils.js";


export class ArticlesRepository {
    constructor(private readonly database: SqliteDatabase) { }


    create(input: CreateArticleInput): Article {
        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            invalidArticleRequest();

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            unsupportedPublishingProfile();

        const timestamp = now();
        const articleId = input.id ?? createId();
        const revisionId = createId();
        const sourceArticleId = input.sourceArticleId;
        if (input.sourceRevisionId && (!sourceArticleId || !this.database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(input.sourceRevisionId, sourceArticleId)))
            invalidArticleRequest();

        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const archived = sourceArticleId ? Number(this.database.prepare("SELECT archived FROM articles WHERE id = ?").get(sourceArticleId)?.archived ?? 0) : 0;
            this.database.prepare("INSERT INTO articles (id, title, language, audience, publishing_profile_id, source_article_id, source_revision_id, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(articleId, requireArticleTitle(input.title), language ?? null, input.audience ?? null, input.publishingProfileId ?? null, sourceArticleId ?? null, input.sourceRevisionId ?? null, archived, timestamp, timestamp);
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
        return (this.database.prepare(`${articleSelect} ORDER BY CASE WHEN d.updated_at IS NOT NULL AND d.updated_at > a.updated_at THEN d.updated_at ELSE a.updated_at END DESC, a.id ASC`).all() as Row[]).map(articleFromRow);
    }


    get(articleId: string): Article | undefined {
        const row = this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row | undefined;
        return row && articleFromRow(row);
    }


    update(articleId: string, input: UpdateArticleInput): Article {
        if (!this.get(articleId))
            articleNotFound();

        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            invalidArticleRequest();

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            unsupportedPublishingProfile();

        const assignments: string[] = [];
        const values: string[] = [];

        if (input.title !== undefined) {
            assignments.push("title = ?");
            values.push(requireArticleTitle(input.title));
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
        deleteArticle(this.database, articleId, (id) => this.get(id));
    }


    setArchived(articleId: string, archived: boolean): Article[] {
        return setArticleArchived(this.database, articleId, archived, (id) => this.get(id), () => this.list());
    }


    setPinned(articleId: string, pinned: boolean): Article {
        return setArticlePinned(this.database, articleId, pinned, (id) => this.get(id));
    }


    reorderPinned(articleIds: string[]): Article[] {
        return reorderPinnedArticles(this.database, articleIds, () => this.list());
    }


    listRevisions(articleId: string): ArticleRevision[] {
        return listArticleRevisions(this.database, articleId);
    }


    getRevision(articleId: string, revisionId: string): ArticleRevision | undefined {
        return getArticleRevision(this.database, articleId, revisionId);
    }


    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                articleNotFound();

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
                articleNotFound();

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
        const revisionId = createId();
        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                articleNotFound();

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            insertArticleRevision(this.database, {
                revisionId,
                articleId,
                content: input.content,
                provenance: input.provenance,
                timestamp,
            });
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getRevision(articleId, revisionId)!;
    }


    saveRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision {
        const revisionId = createId();
        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.get(articleId);
            if (!current)
                articleNotFound();

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
        const revisionId = createId();
        const timestamp = now();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const historical = this.getRevision(articleId, historicalRevisionId);
            if (!historical)
                revisionNotFound();

            insertArticleRevision(this.database, {
                revisionId,
                articleId,
                content: historical.content,
                provenance: { kind: REVISION_PROVENANCE_KIND.RESTORE, restoredFromRevisionId: historicalRevisionId },
                restoredFromRevisionId: historicalRevisionId,
                timestamp,
            });
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getRevision(articleId, revisionId)!;
    }


    appendRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision {
        if (!this.get(articleId))
            articleNotFound();

        const revisionId = createId();
        const timestamp = now();

        this.database.exec("BEGIN IMMEDIATE;");

        try {
            insertArticleRevision(this.database, { revisionId, articleId, content, provenance, restoredFromRevisionId, timestamp });

            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.listRevisions(articleId).find((item) => item.id === revisionId)!;
    }

}
