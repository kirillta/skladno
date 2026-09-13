import assert from "node:assert/strict";
import test from "node:test";
import { createApplicationFailureEvent } from "./application-failure-telemetry.js";

test("application failure telemetry keeps renderer and child exits finite", () => {
    assert.deepEqual(createApplicationFailureEvent("renderer", "crashed"), { kind: "app_failure", source: "renderer", failure: "unknown", termination: "crashed" });
    assert.deepEqual(createApplicationFailureEvent("child_process", "launch-failed"), { kind: "app_failure", source: "child_process", failure: "configuration", termination: "launch_failed" });
    assert.equal(createApplicationFailureEvent("renderer", "clean-exit"), undefined);
    assert.equal(createApplicationFailureEvent("renderer", "private failure text"), undefined);
});
