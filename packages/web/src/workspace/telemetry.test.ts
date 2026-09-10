import { describe, expect, it, vi } from "vitest";
import type { DesktopTelemetryClient } from "@skladno/shared";
import { beginBestEffortTelemetryCapture, captureBestEffortTelemetry } from "./telemetry.js";


describe("workspace telemetry", () => {
    it("keeps unavailable telemetry from affecting editorial work", async () => {
        const client: DesktopTelemetryClient = {
            getTelemetryConsent: vi.fn(),
            setTelemetryConsent: vi.fn(),
            beginTelemetryCapture: vi.fn().mockRejectedValue(new Error("IPC unavailable")),
            captureTelemetry: vi.fn().mockRejectedValue(new Error("IPC unavailable")),
        };

        await expect(beginBestEffortTelemetryCapture(client)).resolves.toBeUndefined();
        captureBestEffortTelemetry(client, { kind: "proposal_reviewed", decision: "accepted" }, 1);
        await Promise.resolve();
        expect(client.captureTelemetry).toHaveBeenCalledWith({ kind: "proposal_reviewed", decision: "accepted" }, 1);

        const throwingClient: DesktopTelemetryClient = { ...client, captureTelemetry: vi.fn(() => {
            throw new Error("IPC unavailable");
        }) };
        expect(() => captureBestEffortTelemetry(throwingClient, { kind: "proposal_reviewed", decision: "accepted" }, 1)).not.toThrow();
    });
});
