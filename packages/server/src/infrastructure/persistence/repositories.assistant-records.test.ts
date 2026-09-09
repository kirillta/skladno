import assert from "node:assert/strict";
import test from "node:test";
import { builtInSkills, legacyEditorialOperationSkillMap } from "@skladno/shared";
import { withRepository } from "./repositories.test-utils.js";
// Product scenarios: cross-cutting.assistant-records-local
test("Assistant compatibility records load current and legacy Skill IDs without rewriting SQLite", () => withRepository((repositories, _close, database) => {
    const article = repositories.articleService.createArticle({ title: "Compatibility", content: "Draft" });
    for (const skillId of builtInSkills) {
        repositories.assistant.createRequest({ id: `current-${skillId}`, articleId: article.id, scope: { kind: "article", baseRevisionId: article.currentRevisionId }, explicitSkillId: skillId });
        assert.equal(repositories.assistant.getRequest(`current-${skillId}`)?.explicitSkillId, skillId);
    }

    for (const [legacyOperation, skillId] of Object.entries(legacyEditorialOperationSkillMap)) {
        const requestId = `legacy-${legacyOperation}`;
        repositories.assistant.createRequest({ id: requestId, articleId: article.id, scope: { kind: "article", baseRevisionId: article.currentRevisionId } });
        database.prepare("UPDATE assistant_requests SET explicit_skill_id = ?, resolved_skill_id = ?, skill_source = 'explicit' WHERE id = ?").run(legacyOperation, legacyOperation, requestId);
        assert.equal(repositories.assistant.getRequest(requestId)?.explicitSkillId, skillId);
        assert.equal(repositories.assistant.getRequest(requestId)?.resolvedSkillId, skillId);
        assert.equal(database.prepare("SELECT explicit_skill_id FROM assistant_requests WHERE id = ?").get(requestId)?.explicit_skill_id, legacyOperation);
    }

    repositories.assistant.createRequest({ id: "legacy-completed", articleId: article.id, scope: { kind: "article", baseRevisionId: article.currentRevisionId } });
    repositories.assistant.completeRequest({ requestId: "legacy-completed", articleId: article.id, responseKind: "proposal_prepared", content: "Done" });
    database.prepare("UPDATE assistant_messages SET skill_id = ? WHERE request_id = ? AND role = 'assistant'").run("flow_revision", "legacy-completed");
    assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.requestId === "legacy-completed" && message.role === "assistant")?.skillId, "flow_and_clarity");
}));


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


test("Assistant capability history is minimal and completion transactions roll back staged writes", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Bounded run", content: "Draft" });
    const request = repositories.assistant.createRequest({ id: "bounded-run", articleId: article.id, scope: { kind: "article", baseRevisionId: article.currentRevisionId } });
    repositories.assistant.setExecution(request.id, "inspect_article");
    repositories.assistant.setExecution(request.id, "inspect_article", "completed");

    const execution = repositories.assistant.getRequest(request.id)?.executions;
    assert.equal(execution?.length, 1);
    assert.deepEqual(Object.keys(execution?.[0] ?? {}).sort(), ["baseRevisionId", "capability", "completedAt", "requestId", "startedAt", "status"]);
    assert.equal(execution?.[0]?.status, "completed");

    assert.throws(() => repositories.assistant.completeRun(() => {
        repositories.editorialArtifacts.create({ articleId: article.id, revisionId: article.currentRevisionId, kind: "assistant-proposal", content: "staged" });
        throw new Error("forced completion failure");
    }), /forced completion failure/);
    assert.deepEqual(repositories.editorialArtifacts.list(article.id), []);
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

    const accepted = repositories.articleService.acceptProposal(article.id, {
        baseRevisionId: article.currentRevisionId,
        content: "After",
        provenance: { kind: "accepted-proposal", baseRevisionId: article.currentRevisionId, editorialArtifactId: artifact.id, wholeProposal: true },
    });
    repositories.articleService.acceptChange(article.id, { content: "Later author edit", provenance: { kind: "author-draft", baseRevisionId: accepted.id } });

    const acceptedProposal = repositories.assistant.listMessages(article.id).find((message) => message.editorialArtifactId === artifact.id);
    assert.deepEqual(acceptedProposal?.proposalAcceptance, { kind: "whole", revisionId: accepted.id });
}));


test("Translation proposals remain recoverable with their Assistant message", () => withRepository((repositories) => {
    const article = repositories.articleService.createArticle({ title: "Source", content: "Hello Node.js" });
    const request = repositories.assistant.createRequest({ id: "translation-request", articleId: article.id, scope: { kind: "article", baseRevisionId: article.currentRevisionId }, explicitSkillId: "translation" });
    repositories.assistant.resolveRequest(request.id, "translation", "explicit");
    const artifact = repositories.editorialArtifacts.create({
        articleId: article.id,
        revisionId: article.currentRevisionId,
        kind: "assistant-proposal",
        content: JSON.stringify({ proposal: "Hola Node.js", translation: { targetLanguage: "Spanish", protectedSpans: ["Node.js"] } }),
    });
    repositories.assistant.completeRequest({ requestId: request.id, articleId: article.id, skillId: "translation", responseKind: "translation_proposal_prepared", content: "", editorialArtifactId: artifact.id });

    const message = repositories.assistant.listMessages(article.id).find((item) => item.editorialArtifactId === artifact.id);

    assert.deepEqual(message?.translation, { content: "Hola Node.js", metadata: { targetLanguage: "Spanish", protectedSpans: ["Node.js"] } });
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

