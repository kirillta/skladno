import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "./database.js";
import { createTestPersistence, type TestPersistence } from "../../test-support/test-persistence.js";


// Product scenarios: history-and-publishing.revision-restore-creates-new, history-and-publishing.style-corpus-local, cross-cutting.assistant-records-local

function withRepository(run: (repositories: TestPersistence, close: () => void, database: ReturnType<typeof openDatabase>) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        run(createTestPersistence(database), () => database.close(), database);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}


test("accepted edits and restores create immutable ordered Revisions", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Versioned article", content: "first" });
    const second = repositories.articleService.acceptChange(article.id, { content: "second", provenance: { kind: "accepted-proposal", operationId: "op-1" } });
    const third = repositories.articleService.acceptChange(article.id, { content: "third", provenance: { kind: "accepted-proposal", operationId: "op-2" } });
    const restored = repositories.articles.restoreRevision(article.id, second.id);
    const revisions = repositories.articles.listRevisions(article.id);

    assert.deepEqual(revisions.map(({ content }) => content), ["first", "second", "third", "second"]);
    assert.equal(repositories.articles.get(article.id)?.currentRevisionId, restored.id);
    assert.equal(restored.restoredFromRevisionId, second.id);
    assert.equal(repositories.articles.listRevisions(article.id).find((item) => item.id === third.id)?.content, "third");
}));


test("Assistant greetings persist a localized template without server-owned copy", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Conversation", content: "Draft" });
    const messages = repositories.assistant.listMessages(article.id);

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.template, "greeting");
    assert.equal(messages[0]?.content, undefined);
}));


test("Assistant author messages retain their resolved skill", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Conversation", content: "Draft" });
    const request = repositories.assistant.createRequest({
        id: "assistant-request",
        articleId: article.id,
        scope: {
            kind: "article",
            baseRevisionId: article.currentRevisionId,
        },
        explicitSkillId: "talking_points",
        skillOffset: 9,
    });

    repositories.assistant.setAuthorMessage(request.id, "Organize these ideas.");
    repositories.assistant.resolveRequest(request.id, "talking_points", "explicit");

    const authorMessage = repositories.assistant.listMessages(article.id).find((message) => message.requestId === request.id && message.role === "author");

    assert.equal(authorMessage?.skillId, "talking_points");
    assert.equal(authorMessage?.skillOffset, 9);
}));


test("Proposal summaries remain recoverable with their Assistant Proposal", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Summaries", content: "Before" });
    const request = repositories.assistant.createRequest({
        id: "summary-request",
        articleId: article.id,
        scope: { kind: "article", baseRevisionId: article.currentRevisionId },
        explicitSkillId: "flow_and_clarity",
    });
    repositories.assistant.setAuthorMessage(request.id, "Improve the flow.");
    repositories.assistant.resolveRequest(request.id, "flow_and_clarity", "explicit");
    const artifact = repositories.editorialArtifacts.create({
        articleId: article.id,
        revisionId: article.currentRevisionId,
        kind: "assistant-proposal",
        content: JSON.stringify({ proposal: "After" }),
    });
    repositories.assistant.completeRequest({
        requestId: request.id,
        articleId: article.id,
        skillId: "flow_and_clarity",
        responseKind: "proposal_prepared",
        content: "",
        proposalContent: "After",
        editorialArtifactId: artifact.id,
    });
    repositories.editorialArtifacts.updateContent(artifact.id, article.id, JSON.stringify({
        proposal: "After",
        proposalSummaries: [{ changeId: "change-1", summary: "Improves the transition." }],
        proposalSummaryLocale: "en",
    }));

    const proposal = repositories.assistant.listMessages(article.id).find((message) => message.editorialArtifactId === artifact.id);

    assert.deepEqual(proposal?.proposalSummaries, [{ changeId: "change-1", summary: "Improves the transition." }]);
    assert.equal(proposal?.proposalSummaryLocale, "en");
}));


test("proposal acceptance requires the reviewed Revision to still be current", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Proposal", content: "before" });
    const accepted = repositories.articleService.acceptProposal(article.id, {
        baseRevisionId: article.currentRevisionId,
        content: "after",
        provenance: { kind: "accepted-proposal", operation: "flow_revision" },
    });

    assert.equal(accepted.content, "after");
    assert.throws(() => repositories.articleService.acceptProposal(article.id, {
        baseRevisionId: article.currentRevisionId,
        content: "stale",
        provenance: { kind: "accepted-proposal" },
    }), /newer revision/);
}));


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


test("Article metadata updates preserve the current Revision", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Metadata", content: "Draft", language: "en" });
    const updated = repositories.articles.update(article.id, {
        title: "Updated metadata",
        language: "es",
        publishingProfileId: "linkedin-short",
    });

    assert.equal(updated.title, "Updated metadata");
    assert.equal(updated.language, "es");
    assert.equal(updated.publishingProfileId, "linkedin-short");
    assert.equal(updated.currentRevisionId, article.currentRevisionId);
    assert.equal(repositories.articles.listRevisions(article.id).length, 1);
    assert.throws(() => repositories.articles.update(article.id, { publishingProfileId: "unknown" }), /Unsupported publishing profile/);
}));


// product: application.local-persistence-reopens
test("materials, settings, artifacts and citations persist through reopening", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const filename = join(directory, "skladno.sqlite");
    const firstDatabase = openDatabase(filename);

    const first = createTestPersistence(firstDatabase);
    const material = first.materials.create({ name: "Voice sample", content: "Original." });
    first.materials.update(material.id, { content: "Edited." });

    const article = first.articleService.createArticle({ title: "Article", content: "Draft" });
    const draft = first.articles.saveDraft(article.id, { content: "Recoverable checkpoint", baseRevisionId: article.currentRevisionId });
    const artifact = first.editorialArtifacts.create({ articleId: article.id, revisionId: article.currentRevisionId, kind: "fact-check", content: "Finding" });
    first.editorialArtifacts.createCitation({ editorialArtifactId: artifact.id, url: "https://example.test/source", uncertainty: "medium" });
    first.settings.set("publishingLimits", { characters: 3000 });
    firstDatabase.close();

    const secondDatabase = openDatabase(filename);
    const second = createTestPersistence(secondDatabase);

    assert.equal(second.materials.get(material.id)?.content, "Edited.");
    assert.deepEqual(second.settings.get("publishingLimits")?.value, { characters: 3000 });
    assert.equal(second.articles.get(article.id)?.currentRevision.content, "Draft");
    assert.equal(second.articles.get(article.id)?.draft?.content, "Recoverable checkpoint");
    assert.equal(second.articles.get(article.id)?.draft?.version, draft.version);
    assert.equal(second.editorialArtifacts.list(article.id).length, 1);
    assert.equal(second.editorialArtifacts.listCitations(artifact.id)[0]?.uncertainty, "medium");

    secondDatabase.close();
    rmSync(directory, { recursive: true, force: true });
});


test("foreign keys and Article ownership reject invalid writes", () => withRepository((repositories) => {
    assert.throws(() => repositories.editorialArtifacts.create({ articleId: "missing", revisionId: "missing", kind: "style", content: "x" }));

    const one = repositories.articleService.createArticle({ title: "One", content: "one" });
    const two = repositories.articleService.createArticle({ title: "Two", content: "two" });

    assert.throws(() => repositories.articles.restoreRevision(one.id, two.currentRevisionId), /Revision not found/);
    assert.throws(() => repositories.materials.create({ name: " ", content: "x" }), /must not be empty/);
}));


test("style corpus keeps raw samples local and rebuilds versioned profiles explicitly", () => withRepository((repositories) => {
    const empty = repositories.styleCorpus.get();
    assert.equal(empty.profile, undefined);

    const corpus = repositories.styleCorpus.add({ name: "Author sample", content: "I explain systems directly.\n\nI use compact paragraphs." });
    assert.equal(corpus.items.length, 1);
    assert.equal(corpus.status, "outdated");
    assert.equal(corpus.profile, undefined);
    assert.equal(corpus.items[0]!.excerpt, "I explain systems directly. I use compact paragraphs.");

    const rebuilt = repositories.styleCorpus.rebuild();
    assert.equal(rebuilt.status, "ready");
    assert.equal(rebuilt.profile?.version, 1);
    assert.equal(rebuilt.profile?.confidence, "low");
    assert.ok(rebuilt.profile?.traits.some((trait) => trait.id === "rhythm"));

    const excluded = repositories.styleCorpus.setIncluded(corpus.items[0]!.id, false);
    assert.equal(excluded.status, "empty");
    assert.equal(excluded.profile?.version, 1);

    repositories.styleCorpus.remove(corpus.items[0]!.id);
    assert.equal(repositories.styleCorpus.get().profile?.version, 1);
    assert.equal(repositories.materials.get(corpus.items[0]!.id), undefined);
}));


test("Article style rules are isolated from the global profile", () => withRepository((repositories) => {
    const first = repositories.articleService.createArticle({ title: "First", content: "One" });
    const second = repositories.articleService.createArticle({ title: "Second", content: "Two" });

    repositories.styleCorpus.setArticleRules(first.id, "Use active voice.");

    assert.equal(repositories.styleCorpus.getArticleRules(first.id), "Use active voice.");
    assert.equal(repositories.styleCorpus.getArticleRules(second.id), "");
    assert.equal(repositories.styleCorpus.get().profile, undefined);
}));
