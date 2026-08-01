import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openDatabase } from "./database.js";
import { Repositories } from "./repositories.js";

function withRepository(run: (repositories: Repositories, close: () => void) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        run(new Repositories(database), () => database.close());
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
    const artifact = first.createEditorialArtifact({ articleId: article.id, revisionId: article.currentRevisionId, kind: "fact-check", content: "Finding" });
    first.createSourceCitation({ editorialArtifactId: artifact.id, url: "https://example.test/source", uncertainty: "medium" });
    first.setSetting("publishingLimits", { characters: 3000 });
    firstDatabase.close();

    const secondDatabase = openDatabase(filename);
    const second = new Repositories(secondDatabase);

    assert.equal(second.getMaterial(material.id)?.content, "Edited.");
    assert.deepEqual(second.getSetting("publishingLimits")?.value, { characters: 3000 });
    assert.equal(second.getArticle(article.id)?.currentRevision.content, "Draft");
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
