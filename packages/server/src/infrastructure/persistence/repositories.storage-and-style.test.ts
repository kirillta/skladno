import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "./database.js";
import { createTestPersistence } from "../../test-support/test-persistence.js";
import { StyleCorpusService } from "../../application/services/editorial/style-corpus-service.js";
import { APPLICATION_ERROR } from "@skladno/shared";
import { withRepository } from "./repositories.test-utils.js";
// Product scenarios: application.local-persistence-reopens, history-and-publishing.style-corpus-local
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

    assert.throws(() => repositories.articles.restoreRevision(one.id, two.currentRevisionId), { code: APPLICATION_ERROR.REVISION_NOT_FOUND });
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

    const readded = repositories.styleCorpus.add({ name: "Author sample", content: "I explain systems directly.\n\nI use compact paragraphs." });
    assert.equal(readded.items.length, 1);
}));


test("Article style rules are isolated from the global profile", () => withRepository((repositories) => {
    const first = repositories.articleService.createArticle({ title: "First", content: "One" });
    const second = repositories.articleService.createArticle({ title: "Second", content: "Two" });

    repositories.styleCorpus.setArticleRules(first.id, "Use active voice.");

    assert.equal(repositories.styleCorpus.getArticleRules(first.id), "Use active voice.");
    assert.equal(repositories.styleCorpus.getArticleRules(second.id), "");
    assert.equal(repositories.styleCorpus.get().profile, undefined);
}));


test("Article Revision snapshots remain local immutable style samples", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Snapshot", content: "First version." });
    const revision = repositories.articles.appendRevision(article.id, "Second version.", { kind: "author-draft" });
    const service = new StyleCorpusService(repositories.styleCorpus, undefined, repositories.articles);

    const corpus = service.addArticleRevision(article.id, revision.id);
    const snapshot = corpus.items[0]!;

    assert.equal(snapshot.origin, "article-revision");
    assert.equal(snapshot.articleId, article.id);
    assert.equal(snapshot.revisionId, revision.id);
    assert.match(snapshot.name, /Snapshot — Revision 2/);
    assert.equal(snapshot.excerpt, "Second version.");
    assert.throws(() => service.addArticleRevision(article.id, revision.id), { code: "duplicate_style_corpus_item" });
}));
