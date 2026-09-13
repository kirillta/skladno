import { randomUUID } from "node:crypto";
import { type TelemetryConsent, type TelemetryEvent } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings } from "../runtime/runtime-settings.js";
import { type TelemetryDelivery } from "./telemetry-delivery.js";

// Public-beta policy. Remove this default in the tracked post-beta follow-up.
const betaTelemetryDefaultEnabled = true;


interface OwnerState {
    readonly generation: number;
    readonly sessionStartedGeneration: number;
    readonly disposed: boolean;
}


/** Main-process-only telemetry consent owner. Delivery is delegated to TelemetryDelivery. */
export function createTelemetryOwner({ runtimePath, delivery }: {
    runtimePath: string;
    delivery: TelemetryDelivery;
}) {
    let state: OwnerState = { generation: 0, sessionStartedGeneration: -1, disposed: false };

    if (delivery.supported && betaTelemetryDefaultEnabled && !readRuntimeSettings(runtimePath).telemetry)
        updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));


    function consent(): TelemetryConsent {
        const telemetry = readRuntimeSettings(runtimePath).telemetry;
        return telemetry?.consent === "granted" && delivery.supported && !state.disposed
            ? { enabled: true, supported: true, installationId: telemetry.installationId }
            : { enabled: false, supported: delivery.supported };
    }


    function stop(): void {
        state = { ...state, generation: state.generation + 1 };
        delivery.stop();
    }


    function capture(event: TelemetryEvent): void {
        const runtime = readRuntimeSettings(runtimePath);
        if (state.disposed || !runtime.telemetry || runtime.telemetry.consent !== "granted" || !delivery.supported)
            return;

        if (event.kind === "app_session_started" && state.sessionStartedGeneration === state.generation)
            return;

        if (!delivery.capture(event, runtime.telemetry.installationId))
            return;

        if (event.kind === "app_session_started")
            state = { ...state, sessionStartedGeneration: state.generation };
    }


    function beginCapture(): (event: TelemetryEvent) => void {
        const currentGeneration = state.generation;
        if (!consent().enabled)
            return () => undefined;

        return (event) => {
            if (currentGeneration === state.generation)
                capture(event);
        };
    }


    function beginCaptureGeneration(): number | undefined {
        return consent().enabled ? state.generation : undefined;
    }


    function captureAtGeneration(event: TelemetryEvent, currentGeneration: number | undefined): void {
        if (currentGeneration !== undefined && currentGeneration === state.generation)
            capture(event);
    }


    return {
        getConsent: consent,
        beginCapture,
        beginCaptureGeneration,
        captureAtGeneration,
        setConsent(enabled: boolean): TelemetryConsent {
            const current = consent();
            if (!enabled) {
                if (readRuntimeSettings(runtimePath).telemetry?.consent === "denied")
                    return current;

                updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "denied" } }));
                stop();
                return consent();
            }

            if (current.enabled || !delivery.supported || state.disposed)
                return current;

            updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));
            state = { ...state, generation: state.generation + 1 };
            capture({ kind: "app_session_started" });

            return consent();
        },
        capture,
        dispose: () => {
            state = { ...state, disposed: true };
            stop();
        },
    };
}
