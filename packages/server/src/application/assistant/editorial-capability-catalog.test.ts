import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EditorialService } from "../editorial/editorial-service.js";
import { PublishingService } from "../publishing/publishing-service.js";
import { StyleCorpusService } from "../editorial/style-corpus-service.js";
import { openDatabase } from "../../infrastructure/persistence/database.js";
import { createTestPersistence } from "../../test-support/test-persistence.js";
import { EDITORIAL_CAPABILITY, EditorialCapabilityCatalog, editorialCapabilityDefinitions, isValidatedEditorialCapabilityCall, validateEditorialCapabilityCoverage } from "./editorial-capability-catalog.js";


function withCatalog(run: (catalog: EditorialCapabilityCatalog, article: import("@skladno/shared").Article) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-capability-catalog-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        const persistence = createTestPersistence(database);
        const article = persistence.articleService.createArticle({ title: "Catalog", content: "Private Article body" });
        const engines = { resolve: () => undefined };
        const editorial = new EditorialService(persistence.articles, persistence.editorialSessions, persistence.styleCorpus, persistence.editorialArtifacts, engines, false, persistence.factChecks);
        run(new EditorialCapabilityCatalog(persistence.articleService, persistence.editorialArtifacts, new PublishingService(persistence.settings), editorial, new StyleCorpusService(persistence.styleCorpus, engines, persistence.articles)), article);
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
    assert.ok(articleResult && typeof articleResult === "object" && "currentRevision" in articleResult);
    assert.equal((articleResult as import("@skladno/shared").Article).currentRevision.content, "Private Article body");
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


test("the catalog owns capability-specific tool input validation", () => {
    assert.ok(isValidatedEditorialCapabilityCall(EDITORIAL_CAPABILITY.INSPECT_ARTICLE, {}));
    assert.ok(isValidatedEditorialCapabilityCall(EDITORIAL_CAPABILITY.GENERATE_PROPOSAL, { operation: "flow_revision" }));
    assert.ok(isValidatedEditorialCapabilityCall(EDITORIAL_CAPABILITY.TRANSLATE, { targetLanguage: "Spanish" }));
    assert.equal(isValidatedEditorialCapabilityCall(EDITORIAL_CAPABILITY.FACT_CHECK, { url: "https://example.com" }), false);
    assert.equal(isValidatedEditorialCapabilityCall(EDITORIAL_CAPABILITY.GENERATE_PROPOSAL, { operation: "anything" }), false);
});


test("classified discovery is bounded and selection scope cannot expose Article reads", () => withCatalog((catalog) => {
    validateEditorialCapabilityCoverage();

    const results = catalog.discover("inspect and change Article language or prepare a translation", "article");
    assert.ok(results.length <= 10);
    assert.ok(results.some((result) => result.capability === EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE));
    assert.ok(results.some((result) => result.capability === EDITORIAL_CAPABILITY.TRANSLATE));

    const selectionResults = catalog.discover("inspect Article metadata and improve clarity", "selection");
    assert.equal(selectionResults.some((result) => result.capability === EDITORIAL_CAPABILITY.INSPECT_ARTICLE), false);
}));


test("catalog metadata actions change only the named current-Article field", () => withCatalog((catalog, article) => {
    const context = { articleId: article.id, baseRevisionId: article.currentRevisionId, authorizedActions: [EDITORIAL_CAPABILITY.RENAME_ARTICLE] as const };
    const renamed = catalog.action(EDITORIAL_CAPABILITY.RENAME_ARTICLE, context, { title: "Renamed Catalog" });

    assert.ok("title" in renamed && "currentRevisionId" in renamed);
    assert.equal(renamed.title, "Renamed Catalog");
    assert.equal(renamed.currentRevisionId, article.currentRevisionId);
    assert.throws(() => catalog.action(EDITORIAL_CAPABILITY.RENAME_ARTICLE, context, { title: "" }), { name: "ApplicationServiceError" });
}));


test("the catalog adds only the current immutable Revision to the Style Corpus", () => withCatalog((catalog, article) => {
    const context = { articleId: article.id, baseRevisionId: article.currentRevisionId };
    assert.throws(() => catalog.action(EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, context), { name: "ApplicationServiceError" });
    const corpus = catalog.action(EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, { ...context, authorizedActions: [EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS] });
    assert.equal(corpus.items[0]?.revisionId, article.currentRevisionId);
    assert.throws(() => catalog.action(EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, { ...context, authorizedActions: [EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS] }), { name: "ApplicationServiceError" });
}));
