import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, type AssistantSkillReference, type AssistantSkillSummary } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./assistant-capability-loop.js";
import { AssistantSkillCatalog, type AssistantSkillSource } from "../skills/assistant-skill-catalog.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import type { EditorialAssistantRequest } from "../../editorial/engine/editorial-assistant-request.js";
import { EDITORIAL_ENGINE_EVENT } from "../../editorial/engine/editorial-engine-events.js";


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
