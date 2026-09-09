import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD } from "@skladno/shared";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import { FixtureEngine, withService } from "./editorial-integration.test-utils.js";

// Product scenarios: editorial-workflows.translation-preserves-source
test("style review uses a compact local profile and saves cited findings as a proposal", async () => {
    const engine = new FixtureEngine([
        {
            type: EDITORIAL_ENGINE_EVENT.COMPLETED,
            responseId: "resp-style-1",
            text: "A concise proposal.",
            styleReview: {
                findings: [{
                    divergence: "The draft uses long paragraphs.",
                    suggestion: "Split the opening paragraph.",
                    traitIds: ["structure"],
                }],
            },
        },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        repositories.styleCorpus.add({ name: "Published sample", content: "I write short sentences.\n\nI keep paragraphs brief." });
        repositories.styleCorpus.rebuild();
        const article = repositories.articleService.createArticle({ title: "Draft", content: "A long draft" });
        repositories.styleCorpus.setArticleRules(article.id, "Use active voice.");
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "style-request", operation: EDITORIAL_OPERATION.STYLE_REVIEW }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.list(article.id)[0]!;

        assert.match(body, /"text":"A concise proposal."/);
        assert.match(body, /"traitIds":\["structure"\]/);
        assert.equal(engine.requests[0]!.styleProfile?.traits.some((trait) => trait.id === "structure"), true);
        assert.deepEqual(JSON.parse(artifact.content).findings, [{
            divergence: "The draft uses long paragraphs.",
            suggestion: "Split the opening paragraph.",
            traitIds: ["structure"],
        }]);
        assert.equal(JSON.parse(artifact.content).articleStyleRules, "Use active voice.");
        assert.equal(JSON.parse(artifact.content).styleProfile.version, 1);
        assert.equal(repositories.articles.get(article.id)?.currentRevision.content, "A long draft");
    });
});


test("translation carries its target language, preserves the source, and records review metadata", async () => {
    const engine = new FixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "translation-1",
        text: "Ejecuta `npm test` en https://example.com.",
        translation: {
            targetLanguage: "Spanish",
            protectedSpans: ["`npm test`", "https://example.com"],
            title: "Fuente",
        },
    }]);

    await withService(engine, async (baseUrl, repositories) => {
        const source = repositories.articleService.createArticle({ title: "Source", content: "Run `npm test` at https://example.com." });
        const response = await fetch(`${baseUrl}/api/articles/${source.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "translation-request", operation: EDITORIAL_OPERATION.TRANSLATION, targetLanguage: "Spanish" }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.list(source.id)[0]!;
        const translated = repositories.articleService.createArticle({
            title: "Source — Spanish",
            content: "Ejecuta `npm test` en https://example.com.",
            language: "es",
            sourceArticleId: source.id,
            sourceRevisionId: source.currentRevisionId,
            provenance: { kind: "accepted-translation", targetLanguage: "Spanish" },
        });

        assert.match(body, /"targetLanguage":"Spanish"/);
        assert.equal(engine.requests[0]?.targetLanguage, "Spanish");
        assert.equal(engine.requests[0]?.articleTitle, "Source");
        assert.equal(repositories.articles.get(source.id)?.currentRevision.content, "Run `npm test` at https://example.com.");
        assert.deepEqual(JSON.parse(artifact.content).translation, {
            targetLanguage: "Spanish",
            protectedSpans: ["`npm test`", "https://example.com"],
            title: "Fuente",
        });
        assert.equal(translated.language, "es");
        assert.equal(translated.sourceArticleId, source.id);
        assert.equal(translated.sourceRevisionNumber, 1);
        assert.equal(repositories.articles.restoreRevision(translated.id, translated.currentRevisionId).content, translated.currentRevision.content);
    });
});

