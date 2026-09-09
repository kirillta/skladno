import type { Article, ArticleDraft, ArticleRevision } from "@skladno/shared";

import { parseObject, type Row } from "./repository-utils.js";


export function revisionFromRow(row: Row): ArticleRevision {
    return {
        id: String(row.id),
        articleId: String(row.article_id),
        content: String(row.content),
        createdAt: String(row.created_at),
        provenance: parseObject(row.provenance_json),
        ...(row.restored_from_revision_id ? { restoredFromRevisionId: String(row.restored_from_revision_id) } : {}),
    };
}


function draftFromRow(row: Row): ArticleDraft | undefined {
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


export function articleFromRow(row: Row): Article {
    const currentRevision = revisionFromRow(row);
    const currentDraft = draftFromRow(row);
    return {
        id: String(row.article_id),
        title: String(row.title),
        createdAt: String(row.article_created_at),
        updatedAt: String(row.article_updated_at),
        currentRevisionId: currentRevision.id,
        currentRevision,
        ...(currentDraft ? { draft: currentDraft } : {}),
        ...(row.language ? { language: String(row.language) } : {}),
        ...(row.audience ? { audience: String(row.audience) } : {}),
        ...(row.publishing_profile_id ? { publishingProfileId: String(row.publishing_profile_id) } : {}),
        ...(row.source_article_id ? { sourceArticleId: String(row.source_article_id) } : {}),
        ...(row.source_revision_id ? { sourceRevisionId: String(row.source_revision_id) } : {}),
        ...(row.source_revision_number ? { sourceRevisionNumber: Number(row.source_revision_number) } : {}),
        archived: Boolean(row.archived),
        ...(row.pin_order === null ? {} : { pinOrder: Number(row.pin_order) }),
    };
}


export const articleSelect = "SELECT a.id article_id, a.title, a.language, a.audience, a.publishing_profile_id, a.source_article_id, a.source_revision_id, a.archived, a.pin_order, (SELECT COUNT(*) FROM article_revisions numbered JOIN article_revisions linked ON linked.id = a.source_revision_id WHERE numbered.article_id = a.source_article_id AND (numbered.created_at < linked.created_at OR (numbered.created_at = linked.created_at AND numbered.id <= linked.id))) source_revision_number, a.created_at article_created_at, a.updated_at article_updated_at, r.*, d.article_id draft_article_id, d.content draft_content, d.base_revision_id draft_base_revision_id, d.version draft_version, d.updated_at draft_updated_at FROM articles a JOIN article_revisions r ON r.id = a.current_revision_id LEFT JOIN article_drafts d ON d.article_id = a.id";
