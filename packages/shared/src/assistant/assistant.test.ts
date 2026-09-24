import assert from "node:assert/strict";
import test from "node:test";

import { ASSISTANT_EVENT, BUILT_IN_SKILL, builtInSkillScopeCompatibility, builtInSkills, editorialOperationSkillMap, isAssistantEvent, isBuiltInSkillId, type AssistantEvent, type AssistantExecutionMetadata, type AssistantRequest, type AssistantSkillSummary, type ElectronStreamRequest, type StartAssistantRequest } from "../index.js";

test("keeps Editorial operations distinct from Skill IDs", () => {
    for (const skillId of builtInSkills)
        assert.equal(isBuiltInSkillId(skillId), true);

    assert.equal(isBuiltInSkillId("thesis_to_narrative"), false);
    assert.equal(isBuiltInSkillId("flow_revision"), false);
    assert.equal(editorialOperationSkillMap.translation, BUILT_IN_SKILL.TRANSLATION);
    assert.deepEqual(builtInSkillScopeCompatibility.talking_points, ["article", "selection"]);
    assert.deepEqual(builtInSkillScopeCompatibility.narrative_draft, ["article", "selection"]);
    assert.deepEqual(builtInSkillScopeCompatibility.skill_creator, ["article", "selection"]);
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
        authorMessage: "Check this.",
        execution,
        createdAt: "2026-08-30T00:00:00.000Z",
        updatedAt: "2026-08-30T00:00:00.000Z",
    } satisfies AssistantRequest;
    const events = [
        { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.id, activity: { summary: "Checking facts.", status: "started" } },
        { type: ASSISTANT_EVENT.STAGED_COMPLETION, requestId: request.id, completion: { responseKind: "findings_prepared" } },
    ] satisfies AssistantEvent[];
    const input = {
        kind: "new",
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


test("validates renderer-safe capability activity stream events", () => {
    assert.equal(isAssistantEvent({ type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: "request-1", activity: { summary: "Checking facts.", status: "started" } }), true);
    assert.equal(isAssistantEvent({ type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: "request-1", activity: { summary: "Checking facts.", status: "running" } }), false);
});
