import { APPLICATION_ERROR, HTTP_STATUS, REVISION_PROVENANCE_KIND, applyProposalChanges, createTextProposal, isArticleLanguage, isPublishLimitProfileId, type AcceptedChange, type AcceptProposalInput, type CreateArticleInput, type UpdateArticleInput, type Article, type ArticleDraft, type ArticleRevision, type SaveArticleDraftInput, type SaveArticleRevisionInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { ArticleDraftConflictError } from "../../../application/articles/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../../../application/articles/article-revision-conflict-error.js";
import { ApplicationServiceError } from "../../../application/errors/application-service-error.js";
import { deleteArticle, reorderPinnedArticles, setArticleArchived, setArticlePinned } from "./article-library-operations.js";
import { throwArticleNotFound, throwInvalidArticleRequest, requireArticleTitle, throwRevisionNotFound, throwUnsupportedPublishingProfile } from "./article-repository-errors.js";
import { mapArticleFromRow, articleSelect } from "./article-record-mappers.js";
import { getArticleRevision, insertArticleRevision, listArticleRevisions } from "./article-revision-queries.js";
import { createId, getCurrentTimestamp, type Row } from "./repository-utils.js";


export class ArticlesRepository {
    constructor(private readonly database: SqliteDatabase) { }


    createArticle(input: CreateArticleInput): Article {
        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            throwInvalidArticleRequest();

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            throwUnsupportedPublishingProfile();

        const timestamp = getCurrentTimestamp();
        const articleId = input.id ?? createId();
        const revisionId = createId();
        const sourceArticleId = input.sourceArticleId;
        this.validateSourceRevision(input.sourceRevisionId, sourceArticleId);
        this.insertInitialArticle(input, { articleId, revisionId, sourceArticleId, language, timestamp });

        return this.getArticle(articleId)!;
    }


    private validateSourceRevision(sourceRevisionId: string | undefined, sourceArticleId: string | undefined): void {
        if (sourceRevisionId && (!sourceArticleId || !this.database.prepare("SELECT 1 FROM article_revisions WHERE id = ? AND article_id = ?").get(sourceRevisionId, sourceArticleId)))
            throwInvalidArticleRequest();
    }


    private insertInitialArticle(input: CreateArticleInput, values: { articleId: string; revisionId: string; sourceArticleId: string | undefined; language: CreateArticleInput["language"]; timestamp: string }): void {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            this.insertArticleRows(input, values);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }
    }


    private insertArticleRows(input: CreateArticleInput, { articleId, revisionId, sourceArticleId, language, timestamp }: { articleId: string; revisionId: string; sourceArticleId: string | undefined; language: CreateArticleInput["language"]; timestamp: string }): void {
        const archived = sourceArticleId ? Number(this.database.prepare("SELECT archived FROM articles WHERE id = ?").get(sourceArticleId)?.archived ?? 0) : 0;
        this.database.prepare("INSERT INTO articles (id, title, language, audience, publishing_profile_id, source_article_id, source_revision_id, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(articleId, requireArticleTitle(input.title), language ?? null, input.audience ?? null, input.publishingProfileId ?? null, sourceArticleId ?? null, input.sourceRevisionId ?? null, archived, timestamp, timestamp);
        this.database.prepare("INSERT INTO article_revisions (id, article_id, content, provenance_json, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(revisionId, articleId, input.content, JSON.stringify(input.provenance ?? { kind: REVISION_PROVENANCE_KIND.INITIAL }), timestamp);
        this.database.prepare("UPDATE articles SET current_revision_id = ? WHERE id = ?").run(revisionId, articleId);
    }


    listArticles(): Article[] {
        return (this.database.prepare(`${articleSelect} ORDER BY CASE WHEN d.updated_at IS NOT NULL AND d.updated_at > a.updated_at THEN d.updated_at ELSE a.updated_at END DESC, a.id ASC`).all() as Row[]).map(mapArticleFromRow);
    }


    getArticle(articleId: string): Article | undefined {
        const row = this.database.prepare(`${articleSelect} WHERE a.id = ?`).get(articleId) as Row | undefined;
        return row && mapArticleFromRow(row);
    }


    updateArticle(articleId: string, input: UpdateArticleInput): Article {
        if (!this.getArticle(articleId))
            throwArticleNotFound();

        const language = input.language;
        if (language !== undefined && !isArticleLanguage(language))
            throwInvalidArticleRequest();

        if (input.publishingProfileId !== undefined && !isPublishLimitProfileId(input.publishingProfileId))
            throwUnsupportedPublishingProfile();

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
        values.push(getCurrentTimestamp(), articleId);
        this.database.prepare(`UPDATE articles SET ${assignments.join(", ")} WHERE id = ?`).run(...values);

        return this.getArticle(articleId)!;
    }


    deleteArticle(articleId: string): void {
        deleteArticle(this.database, articleId, (id) => this.getArticle(id));
    }


    setArticleArchived(articleId: string, archived: boolean): Article[] {
        return setArticleArchived(this.database, articleId, archived, (id) => this.getArticle(id), () => this.listArticles());
    }


    setArticlePinned(articleId: string, pinned: boolean): Article {
        return setArticlePinned(this.database, articleId, pinned, (id) => this.getArticle(id));
    }


    reorderPinnedArticles(articleIds: string[]): Article[] {
        return reorderPinnedArticles(this.database, articleIds, () => this.listArticles());
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
            const current = this.getArticle(articleId);
            if (!current)
                throwArticleNotFound();

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            const existing = current.draft;
            if (existing?.version !== input.expectedDraftVersion)
                throw new ArticleDraftConflictError(current, existing);

            const timestamp = getCurrentTimestamp();
            const version = (existing?.version ?? 0) + 1;
            this.database.prepare("INSERT INTO article_drafts (article_id, content, base_revision_id, version, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET content = excluded.content, base_revision_id = excluded.base_revision_id, version = excluded.version, updated_at = excluded.updated_at")
                .run(articleId, input.content, input.baseRevisionId, version, timestamp);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getArticle(articleId)!.draft!;
    }


    discardDraft(articleId: string, expectedDraftVersion: number): void {
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.getArticle(articleId);
            if (!current)
                throwArticleNotFound();

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
        return this.appendArticleRevision(articleId, change.content, change.provenance);
    }


    acceptProposal(articleId: string, input: AcceptProposalInput, description?: string): ArticleRevision {
        const revisionId = createId();
        const timestamp = getCurrentTimestamp();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.getArticle(articleId);
            if (!current)
                throwArticleNotFound();

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            insertArticleRevision(this.database, {
                revisionId,
                articleId,
                content: input.content,
                description,
                provenance: input.provenance,
                timestamp,
            });
            this.resolveAcceptedCorrections(articleId, input, current.currentRevision.content, timestamp);
            this.database.exec("COMMIT;");
        } catch (error) {
            this.database.exec("ROLLBACK;");
            throw error;
        }

        return this.getRevision(articleId, revisionId)!;
    }


    private resolveAcceptedCorrections(articleId: string, input: AcceptProposalInput, baseContent: string, timestamp: string): void {
        const artifactId = input.provenance.editorialArtifactId;
        if (typeof artifactId !== "string" || input.provenance.wholeProposal !== true)
            return;

        const row = this.database.prepare("SELECT content FROM editorial_artifacts WHERE id = ? AND article_id = ? AND revision_id = ? AND kind = 'editorial-proposal' AND rejected_at IS NULL")
            .get(artifactId, articleId, input.baseRevisionId) as Row | undefined;
        if (!row)
            return;

        const metadata = JSON.parse(String(row.content)) as { proposal?: unknown; correctionSelection?: { expectedRevisionId?: unknown; occurrenceIds?: unknown } };
        const selection = metadata.correctionSelection;
        if (!selection)
            return;

        const ids = selection.occurrenceIds;
        if (selection.expectedRevisionId !== input.baseRevisionId || !Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string") || typeof metadata.proposal !== "string")
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const review = createTextProposal(baseContent, metadata.proposal);
        const expectedContent = applyProposalChanges(review, new Set(review.changes.map((change) => change.id)), true);
        if (input.content === baseContent || input.content !== expectedContent)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const resolve = this.database.prepare("INSERT INTO fact_check_resolutions (occurrence_id, resolution, updated_at) SELECT o.id, 'corrected_or_removed', ? FROM fact_occurrences o JOIN facts f ON f.id = o.fact_id WHERE o.id = ? AND o.revision_id = ? AND f.article_id = ? AND NOT EXISTS (SELECT 1 FROM fact_check_resolutions r WHERE r.occurrence_id = o.id)");
        for (const id of ids) {
            if (resolve.run(timestamp, id, input.baseRevisionId, articleId).changes !== 1)
                throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
        }
    }


    saveRevision(articleId: string, input: SaveArticleRevisionInput, description?: string): ArticleRevision {
        const revisionId = createId();
        const timestamp = getCurrentTimestamp();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const current = this.getArticle(articleId);
            if (!current)
                throwArticleNotFound();

            if (current.currentRevisionId !== input.baseRevisionId)
                throw new ArticleRevisionConflictError(current);

            if (current.draft?.version !== input.expectedDraftVersion)
                throw new ArticleDraftConflictError(current, current.draft);

            if (current.draft && current.draft.content !== input.content)
                throw new ArticleDraftConflictError(current, current.draft);

            const provenance = { kind: REVISION_PROVENANCE_KIND.AUTHOR_DRAFT, baseRevisionId: input.baseRevisionId };
            this.database.prepare("INSERT INTO article_revisions (id, article_id, content, description, provenance_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(revisionId, articleId, input.content, description ?? null, JSON.stringify(provenance), timestamp);
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
        const timestamp = getCurrentTimestamp();
        this.database.exec("BEGIN IMMEDIATE;");
        try {
            const historical = this.getRevision(articleId, historicalRevisionId);
            if (!historical)
                throwRevisionNotFound();

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


    appendArticleRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision {
        if (!this.getArticle(articleId))
            throwArticleNotFound();

        const revisionId = createId();
        const timestamp = getCurrentTimestamp();

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
