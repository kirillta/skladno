import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDatabase, ArticlesRepository, EditorialArtifactsRepository, FactChecksRepository } from "../../../infrastructure/persistence/index.js";
import { persistFactCheckArtifact } from "./persist-fact-check-artifact.js";
import { getReusableFactFindings } from "./reusable-fact-findings.js";

test("Fact identity, separate occurrences, evidence provenance, and inherited resolution survive restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-facts-"));
    const path = join(directory, "data.sqlite");
    let database = openDatabase(path);

    try {
        let articles = new ArticlesRepository(database);
        let artifacts = new EditorialArtifactsRepository(database);
        let checks = new FactChecksRepository(database);
        const article = articles.createArticle({ title: "Test", content: "The RFC was published in 1999." });
        const first = persistFactCheckArtifact({
            artifacts, factChecks: checks, articleId: article.id, revisionId: article.currentRevisionId,
            metadata: {}, factCheck: { findings: [{ claim: "The RFC was published in 1999.", status: "supported", rationale: "RFC", uncertainty: "Primary source", sources: [] }] },
        }).factCheck.findings[0]!;
        checks.resolveFactCheckFinding(first.occurrenceId!, "evidence_accepted");

        const revision = articles.saveRevision(article.id, { baseRevisionId: article.currentRevisionId, content: "In 1999, the RFC was published." });
        const reusable = getReusableFactFindings(checks, article.id)[0]!;
        const second = persistFactCheckArtifact({
            artifacts, factChecks: checks, articleId: article.id, revisionId: revision.id,
            metadata: {}, factCheck: { findings: [{ ...reusable, claim: "In 1999, the RFC was published." }] },
        }).factCheck.findings[0]!;

        assert.equal(first.factId, second.factId);
        assert.notEqual(first.occurrenceId, second.occurrenceId);
        assert.equal(second.checkedAt, first.checkedAt);
        assert.equal(second.reusedFromRevisionId, article.currentRevisionId);
        assert.equal(second.resolution, "evidence_accepted");
        assert.equal((database.prepare("SELECT count(*) AS count FROM facts").get() as { count: number }).count, 1);
        assert.equal((database.prepare("SELECT count(*) AS count FROM fact_occurrences").get() as { count: number }).count, 2);

        database.close();
        database = openDatabase(path);
        articles = new ArticlesRepository(database);
        artifacts = new EditorialArtifactsRepository(database);
        checks = new FactChecksRepository(database);
        const restored = checks.listFactChecks(article.id)[0]!.findings[0]!;
        assert.equal(restored.factId, first.factId);
        assert.equal(restored.resolution, "evidence_accepted");
        assert.equal(restored.checkedAt, first.checkedAt);
        assert.equal(restored.reusedFromRevisionId, article.currentRevisionId);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
