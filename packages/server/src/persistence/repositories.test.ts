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
    try { run(new Repositories(database), () => database.close()); } finally { database.close(); rmSync(directory, { recursive: true, force: true }); }
}


test("accepted edits and restores create immutable ordered versions", () => withRepository((repositories) => {
    const document = repositories.createDocument({ title: "Versioned article", content: "first" });
    const second = repositories.acceptChange(document.id, { content: "second", provenance: { kind: "accepted-proposal", operationId: "op-1" } });
    const third = repositories.acceptChange(document.id, { content: "third", provenance: { kind: "accepted-proposal", operationId: "op-2" } });
    const restored = repositories.restoreVersion(document.id, second.id);
    const versions = repositories.listVersions(document.id);

    assert.deepEqual(versions.map(({ content }) => content), ["first", "second", "third", "second"]);
    assert.equal(repositories.getDocument(document.id)?.currentVersionId, restored.id);
    assert.equal(restored.restoredFromVersionId, second.id);
    assert.equal(repositories.listVersions(document.id).find((item) => item.id === third.id)?.content, "third");
}));


test("proposal acceptance requires the reviewed version to still be current", () => withRepository((repositories) => {
    const document = repositories.createDocument({ title: "Proposal", content: "before" });
    const accepted = repositories.acceptProposal(document.id, {
        baseVersionId: document.currentVersionId,
        content: "after",
        provenance: { kind: "accepted-proposal", operation: "flow_revision" },
    });

    assert.equal(accepted.content, "after");
    assert.throws(() => repositories.acceptProposal(document.id, {
        baseVersionId: document.currentVersionId,
        content: "stale",
        provenance: { kind: "accepted-proposal" },
    }), /newer version/);
}));


test("materials, settings, artifacts and citations persist through reopening", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const filename = join(directory, "skladno.sqlite");
    const firstDatabase = openDatabase(filename); 
    
    const first = new Repositories(firstDatabase);
    const material = first.createMaterial({ name: "Voice sample", content: "Original." });
    first.updateMaterial(material.id, { content: "Edited." });
    
    const document = first.createDocument({ title: "Article", content: "Draft" });
    const artifact = first.createWorkflowArtifact({ documentId: document.id, versionId: document.currentVersionId, kind: "fact-check", content: "Finding" });
    first.createSourceCitation({ artifactId: artifact.id, url: "https://example.test/source", uncertainty: "medium" });
    first.setSetting("publishingLimits", { characters: 3000 }); firstDatabase.close();
    
    const secondDatabase = openDatabase(filename); 
    const second = new Repositories(secondDatabase);
    
    assert.equal(second.getMaterial(material.id)?.content, "Edited.");
    assert.deepEqual(second.getSetting("publishingLimits")?.value, { characters: 3000 });
    assert.equal(second.getDocument(document.id)?.currentVersion.content, "Draft");
    assert.equal(second.listWorkflowArtifacts(document.id).length, 1);
    assert.equal(second.listSourceCitations(artifact.id)[0]?.uncertainty, "medium");

    secondDatabase.close(); 
    rmSync(directory, { recursive: true, force: true });
});


test("foreign keys and document ownership reject invalid writes", () => withRepository((repositories) => {
    assert.throws(() => repositories.createWorkflowArtifact({ documentId: "missing", versionId: "missing", kind: "style", content: "x" }));
    
    const one = repositories.createDocument({ title: "One", content: "one" });
    const two = repositories.createDocument({ title: "Two", content: "two" });
    
    assert.throws(() => repositories.restoreVersion(one.id, two.currentVersionId), /Version not found/);
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
