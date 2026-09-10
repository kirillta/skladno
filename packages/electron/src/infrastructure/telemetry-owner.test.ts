import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTelemetryOwner } from "./telemetry-owner.js";

// Product scenarios: settings.telemetry-consent
test("telemetry is enabled by default during beta and clears identity on opt-out", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    let requests = 0;
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        fetchImplementation: async () => {
            requests += 1;
            return new Response();
        },
        scheduleTimeout: (callback) => {
            queueMicrotask(callback);
            return setTimeout(() => undefined, 0);
        },
    });
    try {
        const firstIdentity = JSON.parse(readFileSync(runtimePath, "utf8")).telemetry.installationId;
        assert.deepEqual(owner.getConsent(), { enabled: true, supported: true, installationId: firstIdentity });
        owner.capture({ kind: "app_failure", failure: "unknown" });
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(requests, 1);
        assert.deepEqual(owner.setConsent(false), { enabled: false, supported: true });
        assert.deepEqual(JSON.parse(readFileSync(runtimePath, "utf8")).telemetry, { consent: "denied" });
        const enabled = owner.setConsent(true);
        assert.equal(enabled.enabled, true);
        assert.equal(enabled.supported, true);
        assert.notEqual(enabled.installationId, firstIdentity);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});


test("an operation begun while telemetry is disabled is not delivered after it is enabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const bodies: string[] = [];
    writeFileSync(runtimePath, JSON.stringify({ telemetry: { consent: "denied" } }));

    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        fetchImplementation: async (_input, init) => {
            bodies.push(String(init?.body));
            return new Response();
        },
        scheduleTimeout: (callback) => {
            queueMicrotask(callback);
            return setTimeout(() => undefined, 0);
        },
    });

    try {
        const capture = owner.beginCapture();
        owner.setConsent(true);
        capture({ kind: "app_failure", failure: "unknown" });
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(bodies.length, 1);
        assert.doesNotMatch(bodies[0]!, /app_failure/);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});
