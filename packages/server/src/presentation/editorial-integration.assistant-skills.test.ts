import assert from "node:assert/strict";
import test from "node:test";
import { HTTP_METHOD } from "@skladno/shared";
import type { EditorialEngine } from "../application/editorial/engine/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/editorial/engine/editorial-engine-event.js";
import type { EditorialAssistantRequest } from "../application/editorial/engine/editorial-assistant-request.js";
import type { AssistantActionIntentVerifier } from "../application/editorial/assistant-action-intent-verifier.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/editorial/engine/editorial-engine-events.js";
import { CapabilityFixtureEngine, createEmptyConversationStream, withService } from "./editorial-integration.test-utils.js";

test("the Assistant model creates an Author-requested Skill without changing the Article", async () => {
    const engine = new CapabilityFixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "created-author-skill", text: "Created the reusable Skill." },
    ], "create_author_skill", {
        skillId: "no-em-dashes",
        skillMarkdown: "---\nid: no-em-dashes\nname: No em dashes\ndescription: Rephrase writing without em dashes.\nversion: 1\n---\n# Rewrite\n\nRewrite without em dashes.\n",
    });

    const verifier: AssistantActionIntentVerifier = {
        verify: async (_message, action) => action === "create_author_skill",
    };

    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requestId: "create-author-skill",
                authorMessage: "Create a reusable Skill that rephrases an Article without em dashes.",
                scope: { kind: "article", baseRevisionId: article.currentRevisionId },
            }),
        });

        assert.match(await response.text(), /"responseKind":"editorial_conversation"/);
        assert.equal(repositories.articles.getArticle(article.id)?.currentRevision.content, "Original Article");
        assert.ok(services.skills.discover().some((skill) => skill.reference.id === "no-em-dashes"));
        assert.equal(services.authorSkills?.listRevisions("no-em-dashes").length, 1);
    }, true, verifier);
});

test("a Skill tool call followed by an incomplete run installs nothing", async () => {
    const engine: EditorialEngine = {
        async *stream() {
            return;
        },
        streamConversation: createEmptyConversationStream,
        async *streamAssistant(request: EditorialAssistantRequest) {
            const creator = request.tools.find((tool) => tool.capability === "create_author_skill");
            assert.ok(creator);
            await creator.execute({
                skillId: "no-em-dashes",
                skillMarkdown: "---\nid: no-em-dashes\nname: No em dashes\ndescription: Rephrase writing without em dashes.\nversion: 1\n---\n# Rewrite\n",
            }, new AbortController().signal);
        },
    };
    const verifier: AssistantActionIntentVerifier = {
        verify: async (_message, action) => action === "create_author_skill",
    };

    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "incomplete-skill", authorMessage: "Create a reusable Skill without em dashes.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.doesNotMatch(await response.text(), /"type":"completed"/);
        assert.equal(services.skills.discover().some((skill) => skill.reference.id === "no-em-dashes"), false);
        assert.equal(services.authorSkills?.listRevisions("no-em-dashes").length, 0);
    }, true, verifier);
});

test("invalid Skill metadata returns a correction and installs nothing", async () => {
    const engine = new CapabilityFixtureEngine([
        { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "invalid-skill", text: "Created the Skill." },
    ], "create_author_skill", {
        skillId: "invalid-skill",
        skillMarkdown: "---\nid: Invalid Skill\nname: Invalid Skill\ndescription: Review writing.\nversion: 1\n---\n# Review\n",
    });
    const verifier: AssistantActionIntentVerifier = { verify: async () => true };
    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "invalid-skill", authorMessage: "Create a reusable Skill.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
        assert.match(await response.text(), /"errorCode":"skill_invalid_metadata"/);
        assert.equal(services.skills.discover().some((skill) => skill.reference.id === "invalid-skill"), false);
    }, true, verifier);
});


test("a failed completion rolls back the created Skill and its history", async () => {
    let changeRevision: () => void = () => undefined;
    const engine: EditorialEngine = {
        async *stream() {
            return;
        },
        streamConversation: createEmptyConversationStream,
        async *streamAssistant(request: EditorialAssistantRequest) {
            const creator = request.tools.find((tool) => tool.capability === "create_author_skill");
            assert.ok(creator);
            await creator.execute({
                skillId: "no-em-dashes",
                skillMarkdown: "---\nid: no-em-dashes\nname: No em dashes\ndescription: Rephrase writing without em dashes.\nversion: 1\n---\n# Rewrite\n",
            }, new AbortController().signal);
            changeRevision();
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "stale-skill", text: "Created the Skill." };
        },
    };
    const verifier: AssistantActionIntentVerifier = {
        verify: async (_message, action) => action === "create_author_skill",
    };

    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        changeRevision = () => {
            repositories.articles.appendArticleRevision(article.id, "New Article", { kind: "test" });
        };
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "stale-skill", authorMessage: "Create a reusable Skill without em dashes.", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.doesNotMatch(await response.text(), /"type":"completed"/);
        assert.equal(services.skills.discover().some((skill) => skill.reference.id === "no-em-dashes"), false);
        assert.equal(services.authorSkills?.listRevisions("no-em-dashes").length, 0);
    }, true, verifier);
});

test("an Author Skill persists its Article result as a Proposal instead of chat", async () => {
    const engine: EditorialEngine = {
        async *stream(request): AsyncIterable<EditorialEngineEvent> {
            assert.equal(request.article, "Original Article");
            assert.equal(request.articleTitle, undefined);
            assert.match(request.authorContext, /Rewrite without em dashes/);
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "proposal", text: "Rephrased without em dashes." };
        },
        streamConversation: createEmptyConversationStream,
        async *streamAssistant(request) {
            const inspect = request.tools.find((tool) => tool.capability === "inspect_article");
            assert.ok(inspect);
            await inspect.execute({}, new AbortController().signal);
            const proposal = request.tools.find((tool) => tool.capability === "generate_proposal");
            assert.ok(proposal);
            await proposal.execute({ operation: "flow_revision" }, new AbortController().signal);
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant", text: "Proposal prepared." };
        },
    };

    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        services.authorSkills!.create({
            skillId: "no-em-dashes",
            requestId: "create-author-skill",
            files: { "SKILL.md": "---\nid: no-em-dashes\nname: No em dashes\ndescription: Rephrase writing without em dashes.\nversion: 1\n---\n# Rewrite\n\nRewrite without em dashes.\n" },
        });
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "author-skill-proposal", authorMessage: "", explicitSkillId: "no-em-dashes", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });

        assert.match(await response.text(), /"responseKind":"proposal_prepared"/);
        assert.equal(repositories.assistant.listMessages(article.id).at(-1)?.responseKind, "proposal_prepared");
        assert.equal(repositories.editorialArtifacts.listEditorialArtifacts(article.id).at(-1)?.kind, "assistant-proposal");
    });
});


// Product scenarios: editorial-workflows.author-skill-creation
test("Assistant chat revises, restores, and deletes an Author Skill only on explicit requests", async () => {
    let capability = "update_author_skill";
    let input: Readonly<Record<string, string>> = {};
    const engine: EditorialEngine = {
        async *stream() {
            return;
        },
        streamConversation: createEmptyConversationStream,
        async *streamAssistant(request: EditorialAssistantRequest) {
            const selected = request.tools.find((tool) => tool.capability === capability);
            assert.ok(selected);
            await selected.execute(input, new AbortController().signal);
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: capability, text: "Skill change completed." };
        },
    };
    const verifier: AssistantActionIntentVerifier = {
        verify: async (_message, action) => action === capability,
    };

    await withService(engine, async (baseUrl, repositories, services) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Original Article" });
        const initial = services.authorSkills!.create({ skillId: "author-review", files: { "SKILL.md": "---\nid: author-review\nname: Author review\ndescription: Review writing.\nversion: 1\n---\n# Review\n" } });
        const send = async (requestId: string, authorMessage: string) => {
            const response = await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
                method: HTTP_METHOD.POST,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ requestId, authorMessage, explicitSkillId: "skill_creator", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
            });
            assert.match(await response.text(), /"type":"completed"/);
        };

        input = { skillId: "author-review", expectedHash: services.authorSkills!.readCurrent("author-review")!.contentHash, skillMarkdown: "---\nid: author-review\nname: Author review\ndescription: Review writing.\nversion: 1\n---\n# Revised review\n" };
        await send("revise-skill", "Revise author-review to use the new review procedure.");
        assert.equal(services.authorSkills!.readCurrent("author-review")?.files["SKILL.md"]?.includes("# Revised review"), true);
        assert.equal(services.authorSkills!.listRevisions("author-review").length, 2);

        capability = "restore_author_skill";
        input = { skillId: "author-review", revisionId: initial.id, expectedHash: services.authorSkills!.readCurrent("author-review")!.contentHash };
        await send("restore-skill", "Restore author-review to its first Skill Revision.");
        assert.equal(services.authorSkills!.readCurrent("author-review")?.files["SKILL.md"]?.includes("# Revised review"), false);
        assert.equal(services.authorSkills!.listRevisions("author-review").length, 3);

        capability = "delete_author_skill";
        input = { skillId: "author-review", expectedHash: services.authorSkills!.readCurrent("author-review")!.contentHash };
        await send("delete-skill", "Delete author-review.");
        assert.equal(services.skills.discover().some((skill) => skill.reference.id === "author-review"), false);
        assert.equal(services.authorSkills!.listRevisions("author-review").length, 3);
    }, true, verifier);
});
