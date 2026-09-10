// Product scenarios: workspace.draft.checkpoint-after-idle

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopTelemetryClient } from "@skladno/shared";
import { createDraftCheckpointTelemetry } from "./draft-checkpoint-telemetry.js";


describe("Draft checkpoint telemetry", () => {
    afterEach(() => vi.useRealTimers());

    it("batches only checkpoint persistence started with telemetry enabled", async () => {
        vi.useFakeTimers();
        const client: DesktopTelemetryClient = {
            getTelemetryConsent: vi.fn(),
            setTelemetryConsent: vi.fn(),
            beginTelemetryCapture: vi.fn().mockResolvedValue(4),
            captureTelemetry: vi.fn().mockResolvedValue(undefined),
        };
        const telemetry = createDraftCheckpointTelemetry(client);
        const generation = await telemetry.begin();
        telemetry.record(generation, true, 12.4);
        telemetry.record(generation, false, 7.6);
        telemetry.record(undefined, true, 3);

        await vi.advanceTimersByTimeAsync(30_000);

        expect(client.captureTelemetry).toHaveBeenCalledWith({ kind: "draft_checkpoint_finished", attempts: 2, successes: 1, failures: 1, elapsedMs: 20 }, 4);
    });
});
