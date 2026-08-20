import assert from "node:assert/strict";
import test from "node:test";

import { createLocalDiagnostics } from "./local-diagnostics.js";


// product: cross-cutting.private-diagnostics
test("local diagnostics redact private values and ignore writer failures", () => {
    const lines: string[] = [];
    const diagnostics = createLocalDiagnostics({
        stdout: (line) => {
            lines.push(line);
        },
        stderr: (line) => {
            lines.push(line);
        },
        environment: { SKLADNO_AI_API_KEY: "secret-key", CUSTOM_KEY: "custom-secret" },
    });

    diagnostics.write("service.started", {
        apiKey: "secret-key",
        article: { content: "private Article body" },
        response: { model: "private model body" },
        detail: "custom-secret",
        status: 200,
    });
    diagnostics.write("request.failed", { body: "private request" }, Object.assign(new Error("private error"), { code: "EFAIL" }));

    const started = JSON.parse(lines[0]!) as { timestamp: string };
    assert.deepEqual(started, {
        timestamp: started.timestamp,
        event: "service.started",
        apiKey: "[REDACTED]",
        article: "[REDACTED]",
        response: "[REDACTED]",
        detail: "[REDACTED]",
        status: 200,
    });
    assert.doesNotMatch(lines[0]!, /secret-key|custom-secret|private Article body|private model body/);

    assert.match(lines[1]!, /"event":"request.failed"/);
    assert.match(lines[1]!, /"errorName":"Error"/);
    assert.match(lines[1]!, /"errorCode":"EFAIL"/);
    assert.doesNotMatch(lines[1]!, /private request|private error/);

    const loadedAfterStartup: NodeJS.ProcessEnv = {};
    const delayedLines: string[] = [];
    const delayedDiagnostics = createLocalDiagnostics({
        stdout: (line) => {
            delayedLines.push(line);
        },
        environment: loadedAfterStartup,
    });
    loadedAfterStartup.CUSTOM_KEY = "loaded-secret";
    delayedDiagnostics.write("service.started", { detail: "loaded-secret" });
    assert.doesNotMatch(delayedLines[0]!, /loaded-secret/);

    createLocalDiagnostics({ stdout: () => {
        throw new Error("unavailable stream");
    } }).write("service.started");
});
