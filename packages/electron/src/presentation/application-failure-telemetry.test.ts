import assert from "node:assert/strict";
import test from "node:test";
import { applicationFailureEvent } from "./application-failure-telemetry.js";

test("application failure telemetry keeps renderer and child exits finite", () => {
    assert.deepEqual(applicationFailureEvent("renderer", "crashed"), { kind: "app_failure", source: "renderer", failure: "unknown", termination: "crashed" });
    assert.deepEqual(applicationFailureEvent("child_process", "launch-failed"), { kind: "app_failure", source: "child_process", failure: "configuration", termination: "launch_failed" });
    assert.equal(applicationFailureEvent("renderer", "clean-exit"), undefined);
    assert.equal(applicationFailureEvent("renderer", "private failure text"), undefined);
});
