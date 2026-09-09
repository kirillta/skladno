import { randomUUID } from "node:crypto";
import { isTelemetryEvent, telemetrySchemaVersion, type TelemetryConsent, type TelemetryEvent } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings } from "./runtime-settings.js";

const allowedIngestionHosts = new Set(["us.i.posthog.com", "eu.i.posthog.com"]);
const queueLimit = 100;
const flushDelayMs = 5_000;
const requestTimeoutMs = 3_000;
// Public-beta policy. Remove this default in the tracked post-beta follow-up.
const betaTelemetryDefaultEnabled = true;


interface DeliveryConfiguration {
    endpoint: URL;
    projectKey: string;
}


interface OutboundEvent {
    event: TelemetryEvent["kind"];
    distinct_id: string;
    properties: TelemetryEvent & {
        schemaVersion: number;
        appVersion: string;
        platform: string;
        architecture: string;
        timestamp: string;
    };
}


function configuration(value: { endpoint?: string; projectKey?: string }): DeliveryConfiguration | undefined {
    if (!value.endpoint || !value.projectKey)
        return undefined;

    try {
        const endpoint = new URL(value.endpoint);
        if (endpoint.protocol !== "https:" || !allowedIngestionHosts.has(endpoint.hostname) || endpoint.pathname !== "/batch")
            return undefined;

        return { endpoint, projectKey: value.projectKey };
    } catch {
        return undefined;
    }
}


function outboundEvent(event: TelemetryEvent, installationId: string, appVersion: string): OutboundEvent | undefined {
    if (!isTelemetryEvent(event))
        return undefined;

    return {
        event: event.kind,
        distinct_id: installationId,
        properties: {
            ...event,
            schemaVersion: telemetrySchemaVersion,
            appVersion,
            platform: process.platform,
            architecture: process.arch,
            timestamp: new Date().toISOString(),
        },
    };
}


/** Main-process-only, in-memory telemetry owner. Delivery is inactive without packaged configuration. */
export function createTelemetryOwner({ runtimePath, packaged, appVersion, delivery, fetchImplementation = fetch, scheduleTimeout = setTimeout }: {
    runtimePath: string;
    packaged: boolean;
    appVersion: string;
    delivery?: { endpoint?: string; projectKey?: string };
    fetchImplementation?: typeof fetch;
    scheduleTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
}) {
    const deliveryConfiguration = packaged ? configuration(delivery ?? {}) : undefined;
    const supported = Boolean(deliveryConfiguration);
    let generation = 0;
    let sessionStartedGeneration = -1;
    let queue: OutboundEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;

    if (supported && betaTelemetryDefaultEnabled && !readRuntimeSettings(runtimePath).telemetry)
        updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));


    function consent(): TelemetryConsent {
        const telemetry = readRuntimeSettings(runtimePath).telemetry;
        return telemetry?.consent === "granted" && supported
            ? { enabled: true, supported, installationId: telemetry.installationId }
            : { enabled: false, supported };
    }


    function stop(): void {
        generation += 1;
        queue = [];
        request?.abort();
        request = undefined;
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
    }


    async function flush(currentGeneration = generation): Promise<void> {
        timer = undefined;
        if (currentGeneration !== generation || !deliveryConfiguration || !queue.length)
            return;

        const batch = queue.splice(0, queue.length);
        request = new AbortController();
        const timeout = setTimeout(() => request?.abort(), requestTimeoutMs);
        try {
            await fetchImplementation(deliveryConfiguration.endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ api_key: deliveryConfiguration.projectKey, batch }),
                signal: request.signal,
            });
        } catch {
            // Delivery never changes editorial work. One bounded retry keeps transient loss quiet.
            if (currentGeneration === generation && queue.length === 0)
                queue = batch;
        } finally {
            clearTimeout(timeout);
            request = undefined;
            if (currentGeneration === generation && queue.length)
                timer = scheduleTimeout(() => void flush(currentGeneration), flushDelayMs);
        }
    }


    function capture(event: TelemetryEvent): void {
        const runtime = readRuntimeSettings(runtimePath);
        if (!runtime.telemetry || runtime.telemetry.consent !== "granted" || !packaged)
            return;

        const outbound = outboundEvent(event, runtime.telemetry.installationId, appVersion);
        if (!outbound || !deliveryConfiguration || queue.length >= queueLimit)
            return;

        if (event.kind === "app_session_started") {
            if (sessionStartedGeneration === generation)
                return;

            sessionStartedGeneration = generation;
        }

        queue.push(outbound);
        if (timer === undefined)
            timer = scheduleTimeout(() => void flush(), flushDelayMs);
    }


    function beginCapture(): (event: TelemetryEvent) => void {
        const currentGeneration = generation;
        if (!consent().enabled)
            return () => undefined;

        return (event) => {
            if (currentGeneration === generation)
                capture(event);
        };
    }


    function beginCaptureGeneration(): number | undefined {
        return consent().enabled ? generation : undefined;
    }


    function captureAtGeneration(event: TelemetryEvent, currentGeneration: number | undefined): void {
        if (currentGeneration === undefined || currentGeneration === generation)
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

            if (current.enabled || !supported)
                return current;

            updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));
            generation += 1;
            capture({ kind: "app_session_started" });

            return consent();
        },
        capture,
        dispose: stop,
    };
}
