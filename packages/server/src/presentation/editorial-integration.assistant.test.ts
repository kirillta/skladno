import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD } from "@skladno/shared";
import type { AssistantActionIntentVerifier } from "../application/editorial/assistant-action-intent-verifier.js";
import type { EditorialEngine } from "../application/editorial/engine/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/editorial/engine/editorial-engine-event.js";
import type { EditorialAssistantRequest } from "../application/editorial/engine/editorial-assistant-request.js";
import type { RevisionDescriptionGenerator } from "../application/editorial/revision-description-generator.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/editorial/engine/editorial-engine-events.js";
import { EditorialEngineError } from "../application/editorial/engine/editorial-engine-error.js";
import { CapabilityFixtureEngine, FixtureEngine, createEmptyConversationStream, withService } from "./editorial-integration.test-utils.js";


// Product scenarios: workspace.assistant.conversational-direct-edit, history-and-publishing.assistant-edit-descriptions
test("an untagged selected edit uses the Article selection instead of asking for text", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "replacement", text: "еще., потом" };
        },
        async *streamConversation(): AsyncIterable<EditorialEngineEvent> {
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "conversation", text: "Conversation" };
        },
        async *streamAssistant(request: EditorialAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
            if (!request.initialActiveCapabilities?.includes("generate_proposal")) {
                yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "conversation", text: "Please provide the Article text." };
                return;
            }

            await request.tools.find((tool) => tool.capability === "generate_proposal")?.execute({ operation: EDITORIAL_OPERATION.FLOW_REVISION }, signal);
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Intermediate model summary.\n\n" };
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "edit", text: "Edit prepared." };
        },
    };
    const verifier: AssistantActionIntentVerifier = {
        verify: async (message, action, input) => message === "Change ё to е" && action === "apply_article_edit" && (input.target === "selection" || input.target === "article"),
        verifyReplacement: async () => false,
    };
    const descriptions: RevisionDescriptionGenerator = { generate: async (before, after, locale) => {
        assert.equal(before, "ещё, потом");
        assert.equal(after, "еще, потом");
        assert.equal(locale, "ru");
        return "Changed ё to е";
    } };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Edit", content: "ещё, потом" });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/messages/edit-mode`, { method: HTTP_METHOD.PUT, headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "direct" }) });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "selected-letter", authorMessage: "Change ё to е", interfaceLocale: "ru", scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 0, endOffset: 10 } }) });

        const events = await response.text();
        assert.match(events, /"responseKind":"edit_applied"/);
        assert.doesNotMatch(events, /"type":"text_delta"/);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "еще, потом");
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.description, "Changed ё to е");

        const protectedArticle = repositories.articleService.createArticle({ title: "Code", content: "Use `ё` here." });
        await fetch(`${baseUrl}/api/articles/${protectedArticle.id}/assistant/messages/edit-mode`, { method: HTTP_METHOD.PUT, headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "direct" }) });
        const protectedResponse = await fetch(`${baseUrl}/api/articles/${protectedArticle.id}/assistant/requests`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "protected-letter", authorMessage: "Change ё to е", scope: { kind: "article", baseRevisionId: protectedArticle.currentRevisionId } }) });
        assert.match(await protectedResponse.text(), /assistant_edit_invalid/);
        assert.equal(repositories.articles.getArticle(protectedArticle.id)?.currentRevision.content, "Use `ё` here.");
    }, true, verifier, undefined, descriptions);
});

// Product scenarios: workspace.assistant.conversational-selection-edit, history-and-publishing.assistant-edit-descriptions
test("completed selection reply applies exact text through one Author click", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "edit", text: "improved" }]);
    const verifier: AssistantActionIntentVerifier = { verify: async () => false, verifyReplacement: async () => true };
    const descriptions: RevisionDescriptionGenerator = { generate: async (before, after, locale) => {
        assert.equal(before, "Before selected after");
        assert.equal(after, "Before improved after");
        assert.equal(locale, "en");
        return "Improved selected passage";
    } };
    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Edit", content: "Before selected after" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "edit-request", authorMessage: "Rephrase this selection.", explicitSkillId: "flow_and_clarity", scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 7, endOffset: 15 } }),
        });
        assert.equal(response.status, 200);
        const reply = repositories.assistant.listMessages(article.id).find((message) => message.requestId === "edit-request" && message.role === "assistant")!;
        assert.deepEqual(reply.editCandidate, { target: "selection", original: "selected", replacement: "improved" });
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Before selected after");
        const applied = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/messages/${reply.id}/apply-edit`, { method: HTTP_METHOD.POST });
        assert.equal(applied.status, 200);
        assert.equal((await applied.json()).content, "Before improved after");
        assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.id === reply.id)?.appliedEdit?.revisionId, repositories.articles.getArticle(article.id)?.currentRevisionId);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.description, "Improved selected passage");
        const repeated = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/messages/${reply.id}/apply-edit`, { method: HTTP_METHOD.POST });
        assert.equal((await repeated.json()).id, repositories.articles.getArticle(article.id)?.currentRevisionId);
        assert.equal(repositories.articles.listRevisions(article.id).length, 2);
    }, true, verifier, undefined, descriptions);
});


// Product scenario: workspace.assistant.conversational-direct-edit
test("direct mode applies only an explicitly authorized whole-Article edit", async () => {
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "edit", text: "After" }]);
    let authorized = false;
    const verifier: AssistantActionIntentVerifier = { verify: async () => authorized, verifyReplacement: async () => true };
    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Direct", content: "Before" });
        const mode = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/messages/edit-mode`, { method: HTTP_METHOD.PUT, headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "direct" }) });
        assert.equal(await mode.json(), "direct");
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "unauthorized", authorMessage: "Discuss a rewrite.", explicitSkillId: "flow_and_clarity", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }) });
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Before");
        assert.deepEqual(repositories.assistant.listMessages(article.id).find((message) => message.requestId === "unauthorized" && message.role === "assistant")?.editCandidate, { target: "article", replacement: "After" });

        authorized = true;
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "authorized", authorMessage: "Replace the Article with the improved wording.", explicitSkillId: "flow_and_clarity", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }) });
        assert.match(await response.text(), /"responseKind":"edit_applied"/);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "After");
        assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.requestId === "authorized" && message.role === "assistant")?.appliedEdit?.revisionId, repositories.articles.getArticle(article.id)?.currentRevisionId);

        const invalid = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: "invalid-direct-edit", authorMessage: "Replace the Article with better wording.", explicitSkillId: "flow_and_clarity", scope: { kind: "article", baseRevisionId: repositories.articles.getArticle(article.id)!.currentRevisionId } }) });
        assert.match(await invalid.text(), /assistant_edit_invalid/);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "After");
        assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.requestId === "invalid-direct-edit" && message.role === "assistant")?.status, "failed");
    }, true, verifier);
});

// Product scenarios: editorial-workflows.assistant-request-proposal, editorial-workflows.proposal-operations-remain-separate, editorial-workflows.author-skill-creation
test("assistant requests persist a revision-bound proposal and splice only the selected Markdown", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "improved" },
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-flow", text: "improved" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "before selected after" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-request-1",
                authorMessage: "Improve the flow of this selection.",
                explicitSkillId: "flow_and_clarity",
                scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 7, endOffset: 15 },
            }),
        });
        const body = await response.text();
        const artifact = repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]!;

        assert.match(body, /"type":"accepted"/);
        assert.match(body, /"type":"skill_resolved".*"skillId":"flow_and_clarity"/);
        assert.match(body, /"type":"capability_activity".*"summary":"Preparing a Proposal\.".*"status":"started"/);
        assert.match(body, /"type":"capability_activity".*"summary":"Preparing a Proposal\.".*"status":"completed"/);
        assert.match(body, /"type":"completed".*"responseKind":"proposal_prepared"/);
        assert.equal(engine.requests[0]?.article, "selected");
        assert.equal(engine.requests[0]?.articleSelection, true);
        assert.equal(JSON.parse(artifact.content).proposal, "before improved after");
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "before selected after");
        assert.equal(repositories.assistant.getRequest("assistant-request-1")?.status, "completed");
        assert.equal(repositories.assistant.listMessages(article.id).filter((message) => message.requestId === "assistant-request-1").length, 2);
        assert.equal(repositories.assistant.listMessages(article.id).find((message) => message.role === "author")?.selectionText, "selected");
        const proposalMessage = repositories.assistant.listMessages(article.id).find((message) => message.requestId === "assistant-request-1" && message.role === "assistant");
        assert.equal(proposalMessage?.proposalContent, "before improved after");
        assert.equal(proposalMessage?.baseRevisionId, article.currentRevisionId);
        assert.equal(proposalMessage?.baseRevisionContent, "before selected after");
    });
});

test("the capability loop does not infer a Style Review from conversational tone", async () => {
    const engine = new CapabilityFixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "catalog-conversation", text: "The argument follows from its premises." },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-tone-conversation", authorMessage: "Do not change the tone. Explain the argument.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.doesNotMatch(body, /"skillId":"style_review"/);
        assert.doesNotMatch(body, /style_corpus_required/);
        assert.equal(JSON.parse(repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]!.content).capability, "generate_proposal");
    });
});


test("the live Assistant routes a plain-language translation request through the Translation tool", async () => {
    const engine = new CapabilityFixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "catalog-translation",
        text: "Artículo traducido",
        translation: { targetLanguage: "Spanish", protectedSpans: [] },
    }], "translate", { targetLanguage: "Spanish" });

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-tool-translation", authorMessage: "Translate the Article into Spanish.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();

        assert.doesNotMatch(body, /"skillId":"translation"/);
        assert.match(body, /"responseKind":"translation_proposal_prepared"/);
        assert.equal(JSON.parse(repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]!.content).capability, "translate");
    });
});


test("the live Assistant tool loop runs no-input artifact capabilities", async () => {
    const engine = new CapabilityFixtureEngine([{
        type: EDITORIAL_ENGINE_EVENT.COMPLETED,
        responseId: "catalog-fact-check",
        text: "",
        factCheck: { findings: [{ claim: "A claim", status: "unverifiable", rationale: "No source.", uncertainty: "Unknown.", sources: [] }] },
    }], "fact_check");

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "A claim" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-tool-fact", authorMessage: "Check this fact.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        const body = await response.text();

        assert.match(body, /"summary":"Checking facts\."/);
        assert.match(body, /"type":"staged_completion"/);
        assert.match(body, /"responseKind":"findings_prepared"/);
        assert.equal(repositories.editorialArtifacts.listEditorialArtifacts(article.id)[0]?.kind, "fact-check");
        assert.equal(repositories.assistant.getRequest("assistant-tool-fact")?.execution?.capability, "fact_check");
    });
});


test("the live Assistant authorizes an exact metadata action in the Author's language", async () => {
    const engine = new CapabilityFixtureEngine([], "rename_article", { title: "Crónica del Río" });
    const verifier: AssistantActionIntentVerifier = {
        verify: async (message, capability, input) => message === "Renombra el artículo a Crónica del Río" && capability === "rename_article" && input.title === "Crónica del Río",
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-spanish-rename", authorMessage: "Renombra el artículo a Crónica del Río", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.equal(response.status, 200);
        assert.equal(repositories.articles.getArticle(article.id)?.title, "Crónica del Río");

        const rejectedArticle = repositories.articleService.createArticle({ title: "Keep this", content: "Original Article" });
        await fetch(`${baseUrl}/api/articles/${rejectedArticle.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-rejected-rename", authorMessage: "No renombres el artículo", scope: { kind: "article", baseRevisionId: rejectedArticle.currentRevisionId } }),
        });
        assert.equal(repositories.articles.getArticle(rejectedArticle.id)?.title, "Keep this");
    }, true, verifier);
});


// Product scenario: editorial-workflows.skill-id-boundary
test("Assistant HTTP rejects an Editorial operation used as a Skill ID", async () => {
    const engine = new FixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "legacy-flow", text: "Improved" },
    ]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "legacy-flow-request",
                authorMessage: "Improve the flow.",
                explicitSkillId: "flow_revision",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.match(await response.text(), /assistant_skill_unsupported/);
        assert.equal(repositories.assistant.getRequest("legacy-flow-request"), undefined);
    });
});


test("Narrative Draft without guidance uses the whole Article and its selected character limit", async () => {
    const engine = new CapabilityFixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-whole-article", text: "improved Article" },
    ], "generate_proposal", { operation: "thesis_to_narrative" }, "generate_proposal");

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "The whole Article", publishingProfileId: "default" });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-whole-article",
                authorMessage: "",
                explicitSkillId: "narrative_draft",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.equal(engine.requests[0]?.article, "The whole Article");
        assert.equal(engine.requests[0]?.articleTitle, "Draft");
        assert.equal(engine.requests[0]?.authorContext, "");
        assert.equal(engine.requests[0]?.skillId, "narrative_draft");
        assert.equal(engine.requests[0]?.targetArticleCharacterLimit, 3_000);
    });
});


test("conversational Assistant requests send only the selected Article context", async () => {
    let conversation: { article: string; scope: "article" | "selection" } | undefined;
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            return;
        },
        async *streamConversation(request): AsyncIterable<EditorialEngineEvent> {
            conversation = { article: request.article, scope: request.scope };
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "conversation-selection", text: "I received the selected text." };
        },
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "before selected after" });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-conversation-selection",
                authorMessage: "What did I send?",
                scope: { kind: "selection", baseRevisionId: article.currentRevisionId, startOffset: 7, endOffset: 15 },
            }),
        });

        assert.deepEqual(conversation, { article: "selected", scope: "selection" });
    });
});


test("assistant streams include a stable failure code", async () => {
    const engine: EditorialEngine = {
        async *stream(): AsyncIterable<EditorialEngineEvent> {
            throw new EditorialEngineError("network", "OpenAI could not be reached. Check your connection and API settings, then retry.");
        },
        streamConversation: createEmptyConversationStream,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "assistant-request-error",
                authorMessage: "Improve the flow.",
                explicitSkillId: "flow_and_clarity",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.match(await response.text(), /"errorCode":"editorial_provider_failed"/);
    });
});
