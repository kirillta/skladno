import type { DesktopTelemetryClient, TelemetryEvent } from "@skladno/shared";


export async function beginBestEffortTelemetryCapture(client: DesktopTelemetryClient | undefined): Promise<number | undefined> {
    try {
        return await client?.beginTelemetryCapture();
    } catch {
        return undefined;
    }
}


export function captureBestEffortTelemetry(client: DesktopTelemetryClient | undefined, event: TelemetryEvent, generation: number | undefined): void {
    try {
        void client?.captureTelemetry(event, generation).catch(() => undefined);
    } catch {
        // Telemetry must not affect editorial work.
    }
}
