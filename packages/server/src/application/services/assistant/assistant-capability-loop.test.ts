import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_SKILL, type AssistantSkillReference, type AssistantSkillSummary } from "@skladno/shared";

import { AssistantCapabilityLoop } from "./assistant-capability-loop.js";
import { AssistantSkillCatalog, type AssistantSkillSource } from "./assistant-skill-catalog.js";
import type { PreparedAssistantRequest } from "../../models/assistant/prepared-assistant-request.js";
import type { EditorialAssistantRequest } from "../../ports/editorial-assistant-request.js";
import { EDITORIAL_ENGINE_EVENT } from "../../ports/editorial-engine-events.js";


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
            yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "response", text: "Done" };
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
            definitions: () => [], discover: () => [], read: () => undefined, action: () => ({ items: [], rules: "", status: "empty" }),
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
