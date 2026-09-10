import type { TelemetryEvent } from "@skladno/shared";


export interface TelemetryObserver {
    beginCapture(): (event: TelemetryEvent) => void;
}
