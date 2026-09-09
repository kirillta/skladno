import assert from "node:assert/strict";
import test from "node:test";
import { APPLICATION_ERROR } from "@skladno/shared";
import { withRepository } from "./repositories.test-utils.js";
// Product scenarios: history-and-publishing.revision-restore-creates-new
test("Draft checkpoints are versioned, recoverable, and separate from Revisions", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Checkpoint", content: "first" });
    const first = repositories.articles.saveDraft(article.id, {
        content: "changed once",
        baseRevisionId: article.currentRevisionId,
    });
    const second = repositories.articles.saveDraft(article.id, {
        content: "changed twice",
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: first.version,
    });

    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(repositories.articles.get(article.id)?.draft?.content, "changed twice");
    assert.equal(repositories.articles.listRevisions(article.id).length, 1);
    assert.throws(() => repositories.articles.saveDraft(article.id, {
        content: "stale write",
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: first.version,
    }), /newer checkpoint/);

    repositories.articles.discardDraft(article.id, second.version);
    assert.equal(repositories.articles.get(article.id)?.draft, undefined);
    assert.throws(() => repositories.articles.discardDraft(article.id, second.version), /newer checkpoint/);
}));


test("Article lists use the latest Article or Draft checkpoint activity", () => withRepository((repositories, _close, database) => {
    const older = repositories.articleService.createArticle({ id: "z", title: "Older", content: "first" });
    const checkpointed = repositories.articleService.createArticle({ id: "a", title: "Checkpointed", content: "first" });
    database.prepare("UPDATE articles SET updated_at = ? WHERE id = ?").run("2026-01-03T00:00:00.000Z", older.id);
    database.prepare("UPDATE articles SET updated_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", checkpointed.id);

    assert.deepEqual(repositories.articles.list().map((item) => item.id), ["z", "a"]);

    const first = repositories.articles.saveDraft(checkpointed.id, { content: "checkpoint one", baseRevisionId: checkpointed.currentRevisionId });
    database.prepare("UPDATE article_drafts SET updated_at = ? WHERE article_id = ?").run("2026-01-04T00:00:00.000Z", checkpointed.id);
    assert.deepEqual(repositories.articles.list().map((item) => item.id), ["a", "z"]);

    const second = repositories.articles.saveDraft(checkpointed.id, { content: "checkpoint two", baseRevisionId: checkpointed.currentRevisionId, expectedDraftVersion: first.version });
    database.prepare("UPDATE article_drafts SET updated_at = ? WHERE article_id = ?").run("2026-01-05T00:00:00.000Z", checkpointed.id);
    assert.deepEqual(repositories.articles.list().map((item) => item.id), ["a", "z"]);
    assert.equal(second.version, 2);
    assert.equal(repositories.articles.listRevisions(checkpointed.id).length, 1);

    repositories.articles.discardDraft(checkpointed.id, second.version);
    database.prepare("UPDATE articles SET updated_at = ?").run("2026-01-06T00:00:00.000Z");
    assert.deepEqual(repositories.articles.list().map((item) => item.id), ["a", "z"]);
}));


test("Draft promotion is atomic and requires matching Revision and Draft versions", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Promotion", content: "first" });
    const draft = repositories.articles.saveDraft(article.id, {
        content: "checkpoint",
        baseRevisionId: article.currentRevisionId,
    });

    assert.throws(() => repositories.articles.saveRevision(article.id, {
        content: "stale draft",
        baseRevisionId: article.currentRevisionId,
    }), /newer checkpoint/);

    const saved = repositories.articles.saveRevision(article.id, {
        content: draft.content,
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: draft.version,
    });
    assert.deepEqual(saved.provenance, { kind: "author-draft", baseRevisionId: article.currentRevisionId });
    assert.equal(repositories.articles.get(article.id)?.draft, undefined);
    assert.equal(repositories.articles.listRevisions(article.id).length, 2);

    const conflictedDraft = repositories.articles.saveDraft(article.id, {
        content: "recover me",
        baseRevisionId: saved.id,
    });
    repositories.articleService.acceptChange(article.id, { content: "new current", provenance: { kind: "accepted-proposal" } });
    assert.throws(() => repositories.articles.saveRevision(article.id, {
        content: conflictedDraft.content,
        baseRevisionId: saved.id,
        expectedDraftVersion: conflictedDraft.version,
    }), /newer revision/);
    assert.equal(repositories.articles.get(article.id)?.draft?.content, "recover me");
}));


test("Article deletion cascades to its Draft", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Cascade", content: "first" });
    repositories.articles.saveDraft(article.id, { content: "checkpoint", baseRevisionId: article.currentRevisionId });
    repositories.articles.delete(article.id);

    assert.equal(repositories.articles.get(article.id), undefined);
}));


test("Article Library archive, pins, and group deletion preserve translation boundaries", () => withRepository((repositories) => {
    const original = repositories.articleService.createArticle({ title: "Original", content: "first" });
    const translation = repositories.articleService.createArticle({ title: "Translation", content: "translated", sourceArticleId: original.id, sourceRevisionId: original.currentRevisionId });
    const sibling = repositories.articleService.createArticle({ title: "Sibling", content: "sibling", sourceArticleId: original.id, sourceRevisionId: original.currentRevisionId });
    const independent = repositories.articleService.createArticle({ title: "Independent", content: "safe" });

    const archived = repositories.articleService.setArticleArchived(translation.id, true);
    assert.deepEqual(new Set(archived.map((article) => article.id)), new Set([original.id, translation.id, sibling.id]));
    assert.ok(archived.every((article) => article.archived));
    assert.equal(repositories.articles.listRevisions(original.id).length, 1);

    repositories.articleService.setArticleArchived(original.id, false);
    const pinned = repositories.articleService.setArticlePinned(original.id, true);
    assert.notEqual(pinned.pinOrder, undefined);
    assert.throws(() => repositories.articleService.setArticlePinned(translation.id, true), { code: APPLICATION_ERROR.INVALID_REQUEST });

    repositories.articleService.deleteArticle(translation.id);
    assert.equal(repositories.articles.get(original.id)?.id, original.id);
    assert.equal(repositories.articles.get(sibling.id)?.id, sibling.id);
    repositories.articleService.deleteArticle(original.id);
    assert.equal(repositories.articles.get(original.id), undefined);
    assert.equal(repositories.articles.get(sibling.id), undefined);
    assert.equal(repositories.articles.get(independent.id)?.id, independent.id);
}));


test("Article metadata updates preserve the current Revision", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Metadata", content: "Draft", language: "en" });
    const updated = repositories.articles.update(article.id, {
        title: "Updated metadata",
        language: "es",
        publishingProfileId: "default",
    });

    assert.equal(updated.title, "Updated metadata");
    assert.equal(updated.language, "es");
    assert.equal(updated.publishingProfileId, "default");
    assert.equal(updated.currentRevisionId, article.currentRevisionId);
    assert.equal(repositories.articles.listRevisions(article.id).length, 1);
    assert.throws(() => repositories.articles.update(article.id, { publishingProfileId: "unknown" }), { code: APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE });
}));


// product: application.local-persistence-reopens
