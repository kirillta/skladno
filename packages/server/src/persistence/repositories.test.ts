import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "./database.js";
import { Repositories } from "./repositories.js";

function withRepository(run: (repositories: Repositories, close: () => void, database: ReturnType<typeof openDatabase>) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        run(new Repositories(database), () => database.close(), database);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}


test("accepted edits and restores create immutable ordered Revisions", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Versioned article", content: "first" });
    const second = repositories.acceptChange(article.id, { content: "second", provenance: { kind: "accepted-proposal", operationId: "op-1" } });
    const third = repositories.acceptChange(article.id, { content: "third", provenance: { kind: "accepted-proposal", operationId: "op-2" } });
    const restored = repositories.restoreRevision(article.id, second.id);
    const revisions = repositories.listArticleRevisions(article.id);

    assert.deepEqual(revisions.map(({ content }) => content), ["first", "second", "third", "second"]);
    assert.equal(repositories.getArticle(article.id)?.currentRevisionId, restored.id);
    assert.equal(restored.restoredFromRevisionId, second.id);
    assert.equal(repositories.listArticleRevisions(article.id).find((item) => item.id === third.id)?.content, "third");
}));


test("proposal acceptance requires the reviewed Revision to still be current", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Proposal", content: "before" });
    const accepted = repositories.acceptProposal(article.id, {
        baseRevisionId: article.currentRevisionId,
        content: "after",
        provenance: { kind: "accepted-proposal", operation: "flow_revision" },
    });

    assert.equal(accepted.content, "after");
    assert.throws(() => repositories.acceptProposal(article.id, {
        baseRevisionId: article.currentRevisionId,
        content: "stale",
        provenance: { kind: "accepted-proposal" },
    }), /newer revision/);
}));


test("Draft checkpoints are versioned, recoverable, and separate from Revisions", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Checkpoint", content: "first" });
    const first = repositories.saveArticleDraft(article.id, {
        content: "changed once",
        baseRevisionId: article.currentRevisionId,
    });
    const second = repositories.saveArticleDraft(article.id, {
        content: "changed twice",
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: first.version,
    });

    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    assert.equal(repositories.getArticle(article.id)?.draft?.content, "changed twice");
    assert.equal(repositories.listArticleRevisions(article.id).length, 1);
    assert.throws(() => repositories.saveArticleDraft(article.id, {
        content: "stale write",
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: first.version,
    }), /newer checkpoint/);

    repositories.discardArticleDraft(article.id, second.version);
    assert.equal(repositories.getArticle(article.id)?.draft, undefined);
    assert.throws(() => repositories.discardArticleDraft(article.id, second.version), /newer checkpoint/);
}));


test("Article lists use the latest Article or Draft checkpoint activity", () => withRepository((repositories, _close, database) => {
    const older = repositories.createArticle({ id: "z", title: "Older", content: "first" });
    const checkpointed = repositories.createArticle({ id: "a", title: "Checkpointed", content: "first" });
    database.prepare("UPDATE articles SET updated_at = ? WHERE id = ?").run("2026-01-03T00:00:00.000Z", older.id);
    database.prepare("UPDATE articles SET updated_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", checkpointed.id);

    assert.deepEqual(repositories.listArticles().map((item) => item.id), ["z", "a"]);

    const first = repositories.saveArticleDraft(checkpointed.id, { content: "checkpoint one", baseRevisionId: checkpointed.currentRevisionId });
    database.prepare("UPDATE article_drafts SET updated_at = ? WHERE article_id = ?").run("2026-01-04T00:00:00.000Z", checkpointed.id);
    assert.deepEqual(repositories.listArticles().map((item) => item.id), ["a", "z"]);

    const second = repositories.saveArticleDraft(checkpointed.id, { content: "checkpoint two", baseRevisionId: checkpointed.currentRevisionId, expectedDraftVersion: first.version });
    database.prepare("UPDATE article_drafts SET updated_at = ? WHERE article_id = ?").run("2026-01-05T00:00:00.000Z", checkpointed.id);
    assert.deepEqual(repositories.listArticles().map((item) => item.id), ["a", "z"]);
    assert.equal(second.version, 2);
    assert.equal(repositories.listArticleRevisions(checkpointed.id).length, 1);

    repositories.discardArticleDraft(checkpointed.id, second.version);
    database.prepare("UPDATE articles SET updated_at = ?").run("2026-01-06T00:00:00.000Z");
    assert.deepEqual(repositories.listArticles().map((item) => item.id), ["a", "z"]);
}));


test("Draft promotion is atomic and requires matching Revision and Draft versions", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Promotion", content: "first" });
    const draft = repositories.saveArticleDraft(article.id, {
        content: "checkpoint",
        baseRevisionId: article.currentRevisionId,
    });

    assert.throws(() => repositories.saveArticleRevision(article.id, {
        content: "stale draft",
        baseRevisionId: article.currentRevisionId,
    }), /newer checkpoint/);

    const saved = repositories.saveArticleRevision(article.id, {
        content: draft.content,
        baseRevisionId: article.currentRevisionId,
        expectedDraftVersion: draft.version,
    });
    assert.deepEqual(saved.provenance, { kind: "author-draft", baseRevisionId: article.currentRevisionId });
    assert.equal(repositories.getArticle(article.id)?.draft, undefined);
    assert.equal(repositories.listArticleRevisions(article.id).length, 2);

    const conflictedDraft = repositories.saveArticleDraft(article.id, {
        content: "recover me",
        baseRevisionId: saved.id,
    });
    repositories.acceptChange(article.id, { content: "new current", provenance: { kind: "accepted-proposal" } });
    assert.throws(() => repositories.saveArticleRevision(article.id, {
        content: conflictedDraft.content,
        baseRevisionId: saved.id,
        expectedDraftVersion: conflictedDraft.version,
    }), /newer revision/);
    assert.equal(repositories.getArticle(article.id)?.draft?.content, "recover me");
}));


test("Article deletion cascades to its Draft", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Cascade", content: "first" });
    repositories.saveArticleDraft(article.id, { content: "checkpoint", baseRevisionId: article.currentRevisionId });
    repositories.deleteArticle(article.id);

    assert.equal(repositories.getArticle(article.id), undefined);
}));


test("Article metadata updates preserve the current Revision", () => withRepository((repositories) => {
    const article = repositories.createArticle({ title: "Metadata", content: "Draft", language: "en" });
    const updated = repositories.updateArticle(article.id, {
        title: "Updated metadata",
        workflowStage: "fact_checking",
        language: "es",
        publishingProfileId: "linkedin-short",
    });

    assert.equal(updated.title, "Updated metadata");
    assert.equal(updated.workflowStage, "fact_checking");
    assert.equal(updated.language, "es");
    assert.equal(updated.publishingProfileId, "linkedin-short");
    assert.equal(updated.currentRevisionId, article.currentRevisionId);
    assert.equal(repositories.listArticleRevisions(article.id).length, 1);
    assert.throws(() => repositories.updateArticle(article.id, { workflowStage: "flow" as never }), /Invalid workflow stage/);
    assert.throws(() => repositories.updateArticle(article.id, { publishingProfileId: "unknown" }), /Unsupported publishing profile/);
}));


test("materials, settings, artifacts and citations persist through reopening", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const filename = join(directory, "skladno.sqlite");
    const firstDatabase = openDatabase(filename);

    const first = new Repositories(firstDatabase);
    const material = first.createMaterial({ name: "Voice sample", content: "Original." });
    first.updateMaterial(material.id, { content: "Edited." });

    const article = first.createArticle({ title: "Article", content: "Draft" });
    const draft = first.saveArticleDraft(article.id, { content: "Recoverable checkpoint", baseRevisionId: article.currentRevisionId });
    const artifact = first.createEditorialArtifact({ articleId: article.id, revisionId: article.currentRevisionId, kind: "fact-check", content: "Finding" });
    first.createSourceCitation({ editorialArtifactId: artifact.id, url: "https://example.test/source", uncertainty: "medium" });
    first.setSetting("publishingLimits", { characters: 3000 });
    firstDatabase.close();

    const secondDatabase = openDatabase(filename);
    const second = new Repositories(secondDatabase);

    assert.equal(second.getMaterial(material.id)?.content, "Edited.");
    assert.deepEqual(second.getSetting("publishingLimits")?.value, { characters: 3000 });
    assert.equal(second.getArticle(article.id)?.currentRevision.content, "Draft");
    assert.equal(second.getArticle(article.id)?.draft?.content, "Recoverable checkpoint");
    assert.equal(second.getArticle(article.id)?.draft?.version, draft.version);
    assert.equal(second.listEditorialArtifacts(article.id).length, 1);
    assert.equal(second.listSourceCitations(artifact.id)[0]?.uncertainty, "medium");

    secondDatabase.close();
    rmSync(directory, { recursive: true, force: true });
});


test("foreign keys and Article ownership reject invalid writes", () => withRepository((repositories) => {
    assert.throws(() => repositories.createEditorialArtifact({ articleId: "missing", revisionId: "missing", kind: "style", content: "x" }));

    const one = repositories.createArticle({ title: "One", content: "one" });
    const two = repositories.createArticle({ title: "Two", content: "two" });

    assert.throws(() => repositories.restoreRevision(one.id, two.currentRevisionId), /Revision not found/);
    assert.throws(() => repositories.createMaterial({ name: " ", content: "x" }), /must not be empty/);
}));


test("style corpus keeps raw samples local and derives confidence from its local contents", () => withRepository((repositories) => {
    const empty = repositories.getStyleCorpus();
    assert.equal(empty.profile, undefined);

    const corpus = repositories.addStyleCorpusItem({ name: "Author sample", content: "I explain systems directly.\n\nI use compact paragraphs." });
    assert.equal(corpus.items.length, 1);
    assert.equal(corpus.profile?.confidence, "low");
    assert.ok(corpus.profile?.traits.some((trait) => trait.id === "sentence-length"));

    repositories.removeStyleCorpusItem(corpus.items[0]!.id);
    assert.equal(repositories.getStyleCorpus().profile, undefined);
    assert.equal(repositories.getMaterial(corpus.items[0]!.id), undefined);
}));
