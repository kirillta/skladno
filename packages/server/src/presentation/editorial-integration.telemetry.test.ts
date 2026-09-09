import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_OPERATION, HTTP_METHOD, type TelemetryEvent } from "@skladno/shared";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/ports/editorial-engine-event.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import { FixtureEngine, noConversation, withService } from "./editorial-integration.test-utils.js";

// Product scenarios: settings.telemetry-consent
test("server records one private-content-free terminal event for each explicit AI operation", async () => {
    const events: TelemetryEvent[] = [];
    const telemetry = { beginCapture: () => (event: TelemetryEvent) => events.push(event) };
    const engine = new FixtureEngine([{ type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "response", text: "Private generated output" }]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Private title", content: "Private Article content" });
        await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "editorial-request", operation: EDITORIAL_OPERATION.FLOW_REVISION, authorContext: "Private prompt" }),
        });
        await fetch(`${baseUrl}/api/articles/${article.id}/assistant/requests`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "assistant-request", authorMessage: "Private prompt", explicitSkillId: "flow_revision", scope: { kind: "article", baseRevisionId: article.currentRevisionId } }),
        });
    }, true, undefined, telemetry);

    assert.deepEqual(events.map((event) => ({ kind: event.kind, operation: event.kind === "ai_operation_finished" ? event.operation : undefined, outcome: event.kind === "ai_operation_finished" ? event.outcome : undefined })), [
        { kind: "ai_operation_finished", operation: "flow_revision", outcome: "completed" },
        { kind: "ai_operation_finished", operation: "assistant", outcome: "completed" },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /Private (title|Article content|prompt|generated output)/);
});


test("a failed direct Editorial operation records one safe failure", async () => {
    const events: TelemetryEvent[] = [];
    const telemetry = { beginCapture: () => (event: TelemetryEvent) => events.push(event) };
    const engine = new FixtureEngine([]);

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Private Article content" });
        await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "failed-editorial-request", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
        });
    }, true, undefined, telemetry);

    assert.equal(events.length, 1);
    const [event] = events;
    assert.ok(event?.kind === "ai_operation_finished");
    assert.deepEqual({ kind: event.kind, operation: event.operation, outcome: event.outcome, failure: event.failure }, { kind: "ai_operation_finished", operation: "flow_revision", outcome: "failed", failure: "unknown" });
    assert.equal(typeof event.elapsedMs, "number");
});


test("a cancelled direct Editorial operation records one cancellation", async () => {
    const events: TelemetryEvent[] = [];
    const telemetry = { beginCapture: () => (event: TelemetryEvent) => events.push(event) };
    const engine: EditorialEngine = {
        async *stream(_request, signal): AsyncIterable<EditorialEngineEvent> {
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial" };
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
        streamConversation: noConversation,
    };

    await withService(engine, async (baseUrl, repositories) => {
        const article = repositories.articleService.createArticle({ title: "Draft", content: "Private Article content" });
        const controller = new AbortController();
        const response = await fetch(`${baseUrl}/api/articles/${article.id}/editorial`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: "cancelled-editorial-request", operation: EDITORIAL_OPERATION.FLOW_REVISION }),
            signal: controller.signal,
        });
        await response.body!.getReader().read();
        controller.abort();
        await new Promise((resolve) => setTimeout(resolve, 10));
    }, true, undefined, telemetry);

    assert.equal(events.length, 1);
    const [event] = events;
    assert.ok(event?.kind === "ai_operation_finished");
    assert.deepEqual({ kind: event.kind, operation: event.operation, outcome: event.outcome, failure: event.failure }, { kind: "ai_operation_finished", operation: "flow_revision", outcome: "cancelled", failure: "cancelled" });
    assert.equal(typeof event.elapsedMs, "number");
});
