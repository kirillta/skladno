import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTelemetryOwner } from "../infrastructure/telemetry-owner.js";
import { registerDesktopTelemetryAdapter } from "./desktop-telemetry.js";

test("telemetry IPC rejects unauthorized senders and unknown properties", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-telemetry-ipc-test-"));
    let handler: ((event: { sender: unknown }, input: unknown) => Promise<unknown>) | undefined;
    const owner = createTelemetryOwner({ runtimePath: join(root, "runtime-settings.json"), packaged: true, appVersion: "0.1.0", delivery: { endpoint: "https://us.i.posthog.com/batch", projectKey: "test" } });
    registerDesktopTelemetryAdapter({
        ipcMain: { handle: (_channel: string, listener: (event: { sender: unknown }, input: unknown) => Promise<unknown>) => {
            handler = listener;
        } } as never,
        isAuthorizedSender: (event) => event.sender === "trusted",
        telemetry: owner,
    });
    try {
        assert.deepEqual(await handler?.({ sender: "other" }, { method: "getConsent" }), { ok: false, error: "invalid_request" });
        assert.deepEqual(await handler?.({ sender: "trusted" }, { method: "capture", event: { kind: "proposal_reviewed", decision: "accepted", articleId: "private" } }), { ok: false, error: "invalid_request" });
        assert.equal(typeof (await handler?.({ sender: "trusted" }, { method: "beginCapture" }) as { value: unknown }).value, "number");
        const result = await handler?.({ sender: "trusted" }, { method: "setConsent", enabled: true }) as { ok: boolean; value: { enabled: boolean; supported: boolean; installationId?: string } };
        assert.equal(result.ok, true);
        assert.equal(result.value.enabled, true);
        assert.equal(result.value.supported, true);
        assert.equal(typeof result.value.installationId, "string");
    } finally {
        owner.dispose();
        rmSync(root, { recursive: true, force: true });
    }
});
