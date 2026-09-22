import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BUILT_IN_SKILL, type AssistantSkillReference, type AssistantSkillSummary } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./assistant-capability-loop.js";
import { AssistantSkillCatalog } from "../skills/assistant-skill-catalog.js";
import type { AssistantSkillSource } from "../skills/assistant-skill-source.js";
import { builtInSkillSource } from "../skills/built-in-skill-source.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import type { EditorialAssistantRequest } from "../../editorial/engine/editorial-assistant-request.js";
import { EDITORIAL_ENGINE_EVENT } from "../../editorial/engine/editorial-engine-events.js";
import { AuthorSkillService } from "../skills/author-skill-service.js";
import { FileAssistantSkillSource } from "../skills/file-assistant-skill-source.js";
import { SkillRevisionStore } from "../../../infrastructure/skills/skill-revision-store.js";


test("Assistant execution loads Skills from its catalog", async () => {
    const reference: AssistantSkillReference = { source: "built-in", id: BUILT_IN_SKILL.FLOW_AND_CLARITY, version: "test" };
    const summary: AssistantSkillSummary = { reference, name: "Catalog Skill", description: "Loaded from the catalog." };
    const source: AssistantSkillSource = {
        id: "built-in",
        summaries: () => [summary],
        load: (candidate) => candidate === reference ? { ...summary, instructions: "Catalog instructions." } : undefined,
    };
    let received: EditorialAssistantRequest | undefined;
    const engine = {
        async *stream() {
            return;
        },
        async *streamConversation() {
            return;
        },
        async *streamAssistant(request: EditorialAssistantRequest) {
            received = request;
            return;
        },
    };
    const request: PreparedAssistantRequest = {
        kind: "new", requestId: "request", articleId: "article", authorMessage: "Improve this.",
        scope: { kind: "article", baseRevisionId: "revision" }, articleContent: "Article", articleTitle: "Title",
        resolvedSkillId: BUILT_IN_SKILL.FLOW_AND_CLARITY, operation: "flow_revision", engine, usesCapabilityLoop: true,
        capabilityActivities: [], pendingActions: [], authorizedActions: [],
    };
    const loop = new AssistantCapabilityLoop({
        assistant: { setExecution: () => undefined }, engines: {},
        capabilities: {
            getDefinitions: () => [], discover: () => [], read: () => undefined, executeAction: () => ({ items: [], rules: "", status: "empty" }),
            stream: async function* () {
                return;
            },
        },
        skills: new AssistantSkillCatalog([source]), conversationHistory: () => [],
    });

    for await (const event of loop.stream(request, new AbortController().signal))
        assert.equal(event.type, EDITORIAL_ENGINE_EVENT.COMPLETED);

    assert.deepEqual(received?.instructions, ["Catalog instructions."]);
    assert.deepEqual(received?.skills.map((skill) => skill.name), ["Catalog Skill"]);
});


test("an Author Skill inspects the current Article before following its instructions", async () => {
    const reference: AssistantSkillReference = { source: "author", id: "no-em-dashes", version: "test" };
    const summary: AssistantSkillSummary = { reference, name: "No em dashes", description: "Rephrase without em dashes." };
    const source: AssistantSkillSource = {
        id: "author",
        summaries: () => [summary],
        load: (candidate) => candidate === reference ? { ...summary, instructions: "Rephrase without em dashes." } : undefined,
    };
    const engine = {
        async *stream() {
            return;
        },
        async *streamConversation() {
            return;
        },
        async *streamAssistant(modelRequest: EditorialAssistantRequest) {
            assert.equal(modelRequest.article, "");
            assert.deepEqual(modelRequest.initialActiveCapabilities, ["inspect_article"]);
            const inspect = modelRequest.tools.find((tool) => tool.capability === "inspect_article");
            assert.ok(inspect);
            assert.deepEqual(await inspect.execute({}, new AbortController().signal), { content: "Article" });
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "response", text: "Rephrased without em dashes." } as const;
        },
    };
    const request: PreparedAssistantRequest = {
        kind: "new", requestId: "request", articleId: "article", authorMessage: "",
        scope: { kind: "article", baseRevisionId: "revision" }, articleContent: "Article", articleTitle: "Title",
        resolvedSkillId: reference.id, engine, usesCapabilityLoop: true,
        capabilityActivities: [], pendingActions: [], authorizedActions: [],
    };
    const loop = new AssistantCapabilityLoop({
        assistant: { setExecution: () => undefined }, engines: {},
        capabilities: {
            getDefinitions: () => [{ id: "inspect_article", execution: "read", allowedContext: "article", input: "none", result: "article", retry: "transient-read", activity: "Reviewing the current Article." }],
            discover: () => [], read: () => ({ content: "Article" }), executeAction: () => ({ items: [], rules: "", status: "empty" }),
            stream: async function* () {
                return;
            },
        },
        skills: new AssistantSkillCatalog([source]), conversationHistory: () => [],
    });

    for await (const event of loop.stream(request, new AbortController().signal))
        assert.equal(event.type, EDITORIAL_ENGINE_EVENT.COMPLETED);
});


test("a resolved Skill cannot complete as a chat response without its artifact", async () => {
    const engine = {
        async *stream() {
            return;
        },
        async *streamConversation() {
            return;
        },
        async *streamAssistant() {
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "response", text: "Generated content in chat" } as const;
        },
    };
    const request: PreparedAssistantRequest = {
        kind: "new", requestId: "request", articleId: "article", authorMessage: "Prepare this.",
        scope: { kind: "article", baseRevisionId: "revision" }, articleContent: "Article", articleTitle: "Title",
        resolvedSkillId: BUILT_IN_SKILL.TALKING_POINTS, operation: "thesis_to_narrative", engine, usesCapabilityLoop: true,
        capabilityActivities: [], pendingActions: [], authorizedActions: [],
    };
    const loop = new AssistantCapabilityLoop({
        assistant: { setExecution: () => undefined }, engines: {},
        capabilities: {
            getDefinitions: () => [], discover: () => [], read: () => undefined, executeAction: () => ({ items: [], rules: "", status: "empty" }),
            stream: async function* () {
                return;
            },
        },
        skills: new AssistantSkillCatalog([]), conversationHistory: () => [],
    });

    const consume = async () => {
        for await (const event of loop.stream(request, new AbortController().signal))
            void event;
    };

    await assert.rejects(consume, { code: "invalid_output" });
});


test("the Assistant model can create an explicitly requested Author Skill without an Editorial artifact", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-loop-"));
    const source = new FileAssistantSkillSource("author", join(root, "skills"));
    const authorSkills = new AuthorSkillService(source, new SkillRevisionStore(root, () => new Date("2026-09-21T00:00:00.000Z"), () => "11111111-1111-4111-8111-111111111111"));
    let modelRequest: EditorialAssistantRequest | undefined;
    const engine = {
        async *stream() {
            return;
        },
        async *streamConversation() {
            return;
        },
        async *streamAssistant(request: EditorialAssistantRequest) {
            modelRequest = request;
            const creator = request.tools.find((tool) => tool.capability === "create_author_skill");
            assert.ok(creator);
            assert.equal(creator.description, "Save a validated local Author Skill Markdown package.");
            assert.deepEqual(request.initialActiveCapabilities, ["create_author_skill"]);
            assert.match(request.skills.find((skill) => skill.id === "skill_creator")?.instructions ?? "", /Ask a concise clarifying question/);
            await creator.execute({
                skillId: "no-em-dashes",
                skillMarkdown: "---\nid: no-em-dashes\nname: No em dashes\ndescription: Rephrase writing without em dashes.\nversion: 1\n---\n# Rewrite\n\nRewrite without em dashes.\n",
            }, new AbortController().signal);
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "created-skill", text: "Created the Skill." } as const;
        },
    };
    const request: PreparedAssistantRequest = {
        kind: "new", requestId: "request", articleId: "article", authorMessage: "Create a Skill without em dashes.",
        scope: { kind: "article", baseRevisionId: "revision" }, articleContent: "Private Article body", articleTitle: "Title",
        resolvedSkillId: BUILT_IN_SKILL.SKILL_CREATOR, engine, usesCapabilityLoop: true,
        capabilityActivities: [], pendingActions: [], authorizedActions: [],
    };
    const loop = new AssistantCapabilityLoop({
        assistant: { setExecution: () => undefined },
        engines: { resolveAssistantActionIntentVerifier: () => ({ verify: async (_message, action) => action === "create_author_skill" }) },
        authorSkills,
        capabilities: {
            getDefinitions: () => [], discover: () => [], read: () => undefined, executeAction: () => ({ items: [], rules: "", status: "empty" }),
            stream: async function* () {
                return;
            },
        },
        skills: new AssistantSkillCatalog([builtInSkillSource]), conversationHistory: () => [],
    });
    try {
        for await (const event of loop.stream(request, new AbortController().signal))
            assert.equal(event.type, EDITORIAL_ENGINE_EVENT.COMPLETED);

        assert.equal(modelRequest?.article, "");
        assert.match(source.get("no-em-dashes")?.instructions ?? "", /Rewrite without em dashes/);
        assert.equal(authorSkills.listRevisions("no-em-dashes").length, 1);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
