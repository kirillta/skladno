import assert from "node:assert/strict";
import test from "node:test";
import { isTelemetryEvent } from "./telemetry.js";

test("telemetry accepts only finite allowlisted event shapes", () => {
    assert.equal(isTelemetryEvent({ kind: "proposal_reviewed", decision: "accepted" }), true);
    assert.equal(isTelemetryEvent({ kind: "ai_operation_finished", operation: "flow_revision", outcome: "completed", elapsedMs: 12 }), true);
    assert.equal(isTelemetryEvent({ kind: "proposal_reviewed", decision: "accepted", title: "private Article" }), false);
    assert.equal(isTelemetryEvent({ kind: "ai_operation_finished", operation: "flow_revision", outcome: "completed", elapsedMs: -1 }), false);
    assert.equal(isTelemetryEvent({ kind: "unknown", context: { secret: "never send" } }), false);
});
