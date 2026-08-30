import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EditorialService } from "../editorial/editorial-service.js";
import { PublishingService } from "../publishing/publishing-service.js";
import { openDatabase } from "../../infrastructure/persistence/database.js";
import { createTestPersistence } from "../../test-support/test-persistence.js";
import { EDITORIAL_CAPABILITY, EditorialCapabilityCatalog, editorialCapabilityDefinitions } from "./editorial-capability-catalog.js";


function withCatalog(run: (catalog: EditorialCapabilityCatalog, article: import("@skladno/shared").Article) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-capability-catalog-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        const persistence = createTestPersistence(database);
        const article = persistence.articleService.createArticle({ title: "Catalog", content: "Private Article body" });
        const engines = { resolve: () => undefined };
        const editorial = new EditorialService(persistence.articles, persistence.editorialSessions, persistence.styleCorpus, persistence.editorialArtifacts, engines, false, persistence.factChecks);
        run(new EditorialCapabilityCatalog(persistence.articleService, persistence.editorialArtifacts, new PublishingService(persistence.settings), editorial), article);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}


test("the editorial capability catalog declares only bounded existing application paths", () => withCatalog((catalog, article) => {
    assert.deepEqual(catalog.definitions(), editorialCapabilityDefinitions);
    assert.equal(new Set(editorialCapabilityDefinitions.map((capability) => capability.id)).size, editorialCapabilityDefinitions.length);
    assert.ok(editorialCapabilityDefinitions.every((capability) => capability.allowedContext === "article" && capability.activity && capability.result && capability.retry));

    const context = { articleId: article.id, baseRevisionId: article.currentRevisionId };
    const artifact = catalog.read({ capability: EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS, context });
    assert.deepEqual(artifact, []);
    const articleResult = catalog.read({ capability: EDITORIAL_CAPABILITY.INSPECT_ARTICLE, context });
    assert.equal("currentRevision" in articleResult && articleResult.currentRevision.content, "Private Article body");
    assert.throws(() => catalog.read({ capability: EDITORIAL_CAPABILITY.INSPECT_REVISIONS, context: { ...context, baseRevisionId: "stale" } }), { name: "ApplicationServiceError" });
}));


test("the catalog rejects a proposal without an approved operation before provider execution", () => withCatalog((catalog, article) => {
    const context = { articleId: article.id, baseRevisionId: article.currentRevisionId };
    assert.throws(() => catalog.stream({
        capability: EDITORIAL_CAPABILITY.GENERATE_PROPOSAL,
        context,
        requestId: "catalog-request",
        authorContext: "",
    }, new AbortController().signal), { name: "ApplicationServiceError" });
}));
