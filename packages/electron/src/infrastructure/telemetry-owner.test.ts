import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTelemetryOwner, readTelemetryDelivery } from "./telemetry-owner.js";


function scheduler() {
    const callbacks = new Map<ReturnType<typeof setTimeout>, () => void>();

    return {
        schedule: (callback: () => void) => {
            const timeout = setTimeout(() => undefined, 60_000);
            callbacks.set(timeout, callback);
            return timeout;
        },
        clear: (timeout: ReturnType<typeof setTimeout>) => {
            clearTimeout(timeout);
            callbacks.delete(timeout);
        },
        async run(): Promise<void> {
            for (const [timeout, callback] of callbacks) {
                callbacks.delete(timeout);
                clearTimeout(timeout);
                callback();
                await new Promise((resolve) => setImmediate(resolve));
                return;
            }

            assert.fail("Expected telemetry delivery to be scheduled.");
        },
        get size() {
            return callbacks.size;
        },
    };
}


function event() {
    return { kind: "app_failure", source: "startup", failure: "unknown" } as const;
}


// Product scenarios: settings.telemetry-consent
test("telemetry is enabled by default during beta, reports trusted OS version, and clears identity on opt-out", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const tasks = scheduler();
    const bodies: string[] = [];
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        osVersion: "trusted-os-version",
        fetchImplementation: async (_input, init) => {
            bodies.push(String(init?.body));
            return new Response(null, { status: 200 });
        },
        scheduleTimeout: tasks.schedule,
        clearScheduledTimeout: tasks.clear,
    });
    try {
        const firstIdentity = JSON.parse(readFileSync(runtimePath, "utf8")).telemetry.installationId;
        assert.deepEqual(owner.getConsent(), { enabled: true, supported: true, installationId: firstIdentity });
        owner.capture(event());
        await tasks.run();
        const payload = JSON.parse(bodies[0]!) as { batch: { properties: Record<string, unknown> }[] };
        assert.equal(payload.batch[0]?.properties.osVersion, "trusted-os-version");
        assert.equal("title" in payload.batch[0]!.properties, false);
        assert.deepEqual(owner.setConsent(false), { enabled: false, supported: true });
        assert.deepEqual(JSON.parse(readFileSync(runtimePath, "utf8")).telemetry, { consent: "denied" });
        const enabled = owner.setConsent(true);
        assert.equal(enabled.enabled, true);
        assert.notEqual(enabled.installationId, firstIdentity);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});

test("operations begun without consent and stale generations are not delivered", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const tasks = scheduler();
    const bodies: string[] = [];
    writeFileSync(runtimePath, JSON.stringify({ telemetry: { consent: "denied" } }));
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        fetchImplementation: async (_input, init) => {
            bodies.push(String(init?.body));
            return new Response(null, { status: 200 });
        },
        scheduleTimeout: tasks.schedule,
        clearScheduledTimeout: tasks.clear,
    });
    try {
        const disabled = owner.beginCaptureGeneration();
        owner.setConsent(true);
        owner.captureAtGeneration(event(), disabled);
        const enabled = owner.beginCaptureGeneration();
        owner.setConsent(false);
        owner.setConsent(true);
        owner.captureAtGeneration(event(), enabled);
        await tasks.run();
        assert.equal(bodies.length, 1);
        assert.doesNotMatch(bodies[0]!, /app_failure/);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});

test("delivery retries network failures and rate limits once, then drops permanent failures and redirects", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const tasks = scheduler();
    let attempts = 0;
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        fetchImplementation: async () => {
            attempts += 1;
            if (attempts === 1)
                throw new Error("offline");

            if (attempts === 3)
                return new Response(null, { status: 429, headers: { "retry-after": "0" } });

            if (attempts === 5)
                return new Response(null, { status: 400 });

            return new Response(null, { status: 302, headers: { location: "https://outside.example/batch" } });
        },
        scheduleTimeout: tasks.schedule,
        clearScheduledTimeout: tasks.clear,
    });
    try {
        owner.capture(event());
        await tasks.run();
        await tasks.run();
        owner.capture(event());
        await tasks.run();
        await tasks.run();
        owner.capture(event());
        await tasks.run();
        owner.capture(event());
        await tasks.run();
        assert.equal(attempts, 6);
        assert.equal(tasks.size, 0);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});

test("delivery expires old events, caps retained event rate, and stops an active request on opt-out", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const tasks = scheduler();
    let currentTime = 0;
    let attempts = 0;
    let batchSize = 0;
    let resolveRequest: (() => void) | undefined;
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        now: () => currentTime,
        fetchImplementation: async (_input, init) => {
            attempts += 1;
            batchSize = String(init?.body).match(/"event":"app_failure"/g)?.length ?? 0;
            if (attempts === 1)
                return new Promise<Response>((resolve) => {
                    resolveRequest = () => resolve(new Response(null, { status: 200 }));
                    const signal = init?.signal;
                    if (!signal)
                        throw new Error("Expected an abort signal.");

                    signal.addEventListener("abort", () => resolve(new Response(null, { status: 499 })), { once: true });
                });

            return new Response(null, { status: 200 });
        },
        scheduleTimeout: tasks.schedule,
        clearScheduledTimeout: tasks.clear,
    });
    try {
        owner.capture(event());
        currentTime = 5 * 60_000 + 1;
        await tasks.run();
        assert.equal(attempts, 0);
        for (let index = 0; index < 101; index += 1)
            owner.capture(event());

        await tasks.run();
        assert.equal(attempts, 1);
        assert.equal(batchSize, 100);
        owner.setConsent(false);
        resolveRequest?.();
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(tasks.size, 0);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});

test("delivery retries a timed-out request once", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    const tasks = scheduler();
    let attempts = 0;
    const owner = createTelemetryOwner({
        runtimePath,
        packaged: true,
        appVersion: "0.1.0",
        delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" },
        requestTimeout: 1,
        fetchImplementation: async (_input, init) => new Promise<Response>((_resolve, reject) => {
            attempts += 1;
            const signal = init?.signal;
            if (!signal)
                throw new Error("Expected an abort signal.");

            signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
        }),
        scheduleTimeout: tasks.schedule,
        clearScheduledTimeout: tasks.clear,
    });
    try {
        owner.capture(event());
        await tasks.run();
        await new Promise((resolve) => setTimeout(resolve, 5));
        await tasks.run();
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.equal(attempts, 2);
        assert.equal(tasks.size, 0);
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});

test("telemetry delivery configuration accepts only the packaged finite shape", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-config-test-"));
    const path = join(root, "telemetry.json");
    try {
        writeFileSync(path, JSON.stringify({ endpoint: "https://us.i.posthog.com/batch", projectKey: "public" }));
        assert.deepEqual(readTelemetryDelivery(path), { endpoint: "https://us.i.posthog.com/batch", projectKey: "public" });
        writeFileSync(path, JSON.stringify({ endpoint: "https://us.i.posthog.com/batch", projectKey: "public", secret: "no" }));
        assert.equal(readTelemetryDelivery(path), undefined);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
