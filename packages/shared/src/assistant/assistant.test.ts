import assert from "node:assert/strict";
import test from "node:test";

import { ASSISTANT_EVENT, BUILT_IN_SKILL, builtInSkillScopeCompatibility, builtInSkills, legacyEditorialOperationSkillMap, resolveBuiltInSkillId, type AssistantEvent, type AssistantExecutionMetadata, type AssistantRequest, type AssistantSkillSummary, type ElectronStreamRequest, type StartAssistantRequest } from "../index.js";

test("resolves current skill IDs and legacy editorial operations through one compatibility seam", () => {
    for (const skillId of builtInSkills)
        assert.equal(resolveBuiltInSkillId(skillId), skillId);

    assert.equal(resolveBuiltInSkillId("thesis_to_narrative"), BUILT_IN_SKILL.NARRATIVE_DRAFT);
    assert.equal(resolveBuiltInSkillId("flow_revision"), BUILT_IN_SKILL.FLOW_AND_CLARITY);
    assert.equal(resolveBuiltInSkillId("unknown"), undefined);
    assert.equal(legacyEditorialOperationSkillMap.translation, BUILT_IN_SKILL.TRANSLATION);
    assert.deepEqual(builtInSkillScopeCompatibility.talking_points, ["article", "selection"]);
    assert.deepEqual(builtInSkillScopeCompatibility.narrative_draft, ["article", "selection"]);
});


test("describes source-neutral Skills and capability-run transport fixtures", () => {
    const summary = {
        reference: { source: "built-in", id: BUILT_IN_SKILL.FACT_CHECKING, version: "1" },
        name: "Fact Check",
        description: "Review factual claims.",
    } satisfies AssistantSkillSummary;
    const execution = {
        capability: "fact-check",
        status: "completed",
        requestId: "request-1",
        baseRevisionId: "revision-1",
    } satisfies AssistantExecutionMetadata;
    const request = {
        id: execution.requestId,
        articleId: "article-1",
        baseRevisionId: execution.baseRevisionId,
        scope: { kind: "article", baseRevisionId: execution.baseRevisionId },
        status: execution.status,
        execution,
        createdAt: "2026-08-30T00:00:00.000Z",
        updatedAt: "2026-08-30T00:00:00.000Z",
    } satisfies AssistantRequest;
    const events = [
        { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.id, activity: { summary: "Checking facts.", status: "started" } },
        { type: ASSISTANT_EVENT.STAGED_COMPLETION, requestId: request.id, completion: { responseKind: "findings_prepared" } },
    ] satisfies AssistantEvent[];
    const input = {
        requestId: request.id,
        authorMessage: "Check this.",
        scope: request.scope,
        explicitSkillId: BUILT_IN_SKILL.FACT_CHECKING,
    } satisfies StartAssistantRequest;
    const electronRequest = {
        streamId: "stream-1",
        kind: "assistant",
        articleId: request.articleId,
        input,
    } satisfies ElectronStreamRequest;

    assert.equal(summary.reference.id, BUILT_IN_SKILL.FACT_CHECKING);
    assert.equal(events[1]?.type, ASSISTANT_EVENT.STAGED_COMPLETION);
    assert.equal(electronRequest.input.requestId, request.id);
});
