import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { release } from "node:os";
import { isTelemetryEvent, telemetrySchemaVersion, type TelemetryConsent, type TelemetryEvent } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings } from "./runtime-settings.js";

const allowedIngestionHosts = new Set(["us.i.posthog.com"]);
const queueLimit = 100;
const eventRateLimit = 100;
const eventRateWindowMs = 60_000;
const eventExpiryMs = 5 * 60_000;
const flushDelayMs = 5_000;
const retryDelayMs = 5_000;
const maxRetryDelayMs = 30_000;
const requestTimeoutMs = 3_000;
const maxRetries = 1;
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
        osVersion: string;
        timestamp: string;
    };
}


interface QueuedEvent {
    outbound: OutboundEvent;
    queuedAt: number;
    retries: number;
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


export function readTelemetryDelivery(path: string): { endpoint?: string; projectKey?: string } | undefined {
    try {
        const value: unknown = JSON.parse(readFileSync(path, "utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value))
            return undefined;

        const record = value as Record<string, unknown>;
        if (Object.keys(record).some((key) => key !== "endpoint" && key !== "projectKey"))
            return undefined;

        return {
            ...(typeof record.endpoint === "string" ? { endpoint: record.endpoint } : {}),
            ...(typeof record.projectKey === "string" ? { projectKey: record.projectKey } : {}),
        };
    } catch {
        return undefined;
    }
}


function outboundEvent(event: TelemetryEvent, installationId: string, appVersion: string, osVersion: string): OutboundEvent | undefined {
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
            osVersion,
            timestamp: new Date().toISOString(),
        },
    };
}


function retryAfter(response: Response): number {
    const seconds = Number(response.headers.get("retry-after"));
    if (!Number.isFinite(seconds) || seconds < 0)
        return retryDelayMs;

    return Math.min(maxRetryDelayMs, Math.round(seconds * 1_000));
}


/** Main-process-only, bounded in-memory telemetry owner. Delivery is inactive without packaged configuration. */
export function createTelemetryOwner({ runtimePath, packaged, appVersion, delivery, fetchImplementation = fetch, scheduleTimeout = setTimeout, clearScheduledTimeout = clearTimeout, now = Date.now, osVersion = release(), requestTimeout = requestTimeoutMs }: {
    runtimePath: string;
    packaged: boolean;
    appVersion: string;
    delivery?: { endpoint?: string; projectKey?: string };
    fetchImplementation?: typeof fetch;
    scheduleTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    clearScheduledTimeout?: (timeout: ReturnType<typeof setTimeout>) => void;
    now?: () => number;
    osVersion?: string;
    requestTimeout?: number;
}) {
    const deliveryConfiguration = packaged ? configuration(delivery ?? {}) : undefined;
    const supported = Boolean(deliveryConfiguration);
    let generation = 0;
    let sessionStartedGeneration = -1;
    let queue: QueuedEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeRequest: { controller: AbortController; generation: number; batchSize: number } | undefined;
    let disposed = false;
    let rateWindowStartedAt = now();
    let acceptedInRateWindow = 0;

    if (supported && betaTelemetryDefaultEnabled && !readRuntimeSettings(runtimePath).telemetry)
        updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));


    function consent(): TelemetryConsent {
        const telemetry = readRuntimeSettings(runtimePath).telemetry;
        return telemetry?.consent === "granted" && supported && !disposed
            ? { enabled: true, supported, installationId: telemetry.installationId }
            : { enabled: false, supported };
    }


    function stop(): void {
        generation += 1;
        queue = [];
        activeRequest?.controller.abort();
        activeRequest = undefined;
        if (timer !== undefined) {
            clearScheduledTimeout(timer);
            timer = undefined;
        }
    }


    function schedule(currentGeneration: number, delay = flushDelayMs): void {
        if (disposed || currentGeneration !== generation || !queue.length || timer !== undefined)
            return;

        timer = scheduleTimeout(() => void flush(currentGeneration), delay);
    }


    function retainedCount(): number {
        return queue.length + (activeRequest?.generation === generation ? activeRequest.batchSize : 0);
    }


    function withinRateLimit(): boolean {
        const current = now();
        if (current - rateWindowStartedAt >= eventRateWindowMs) {
            rateWindowStartedAt = current;
            acceptedInRateWindow = 0;
        }

        if (acceptedInRateWindow >= eventRateLimit)
            return false;

        acceptedInRateWindow += 1;
        return true;
    }


    async function flush(currentGeneration = generation): Promise<void> {
        timer = undefined;
        if (disposed || currentGeneration !== generation || !deliveryConfiguration || !queue.length || activeRequest)
            return;

        const startedAt = now();
        const batch = queue.splice(0, queue.length).filter((entry) => startedAt - entry.queuedAt <= eventExpiryMs);
        if (!batch.length) {
            schedule(currentGeneration);
            return;
        }

        const controller = new AbortController();
        activeRequest = { controller, generation: currentGeneration, batchSize: batch.length };
        const timeout = setTimeout(() => controller.abort(), requestTimeout);
        let retry = false;
        let delay = retryDelayMs;
        try {
            const response = await fetchImplementation(deliveryConfiguration.endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ api_key: deliveryConfiguration.projectKey, batch: batch.map((entry) => entry.outbound) }),
                signal: controller.signal,
                redirect: "manual",
            });
            retry = response.status === 429 || response.status >= 500;
            if (response.status === 429)
                delay = retryAfter(response);
        } catch {
            retry = true;
        } finally {
            clearTimeout(timeout);
            if (activeRequest?.controller === controller)
                activeRequest = undefined;

            if (!disposed && currentGeneration === generation && retry) {
                const retried = batch
                    .filter((entry) => entry.retries < maxRetries && now() - entry.queuedAt <= eventExpiryMs)
                    .map((entry) => ({ ...entry, retries: entry.retries + 1 }));
                queue = [...retried, ...queue];
            }

            schedule(currentGeneration, retry ? delay : flushDelayMs);
        }
    }


    function capture(event: TelemetryEvent): void {
        const runtime = readRuntimeSettings(runtimePath);
        if (disposed || !runtime.telemetry || runtime.telemetry.consent !== "granted" || !packaged || !deliveryConfiguration || retainedCount() >= queueLimit)
            return;

        const outbound = outboundEvent(event, runtime.telemetry.installationId, appVersion, osVersion);
        if (!outbound || !withinRateLimit())
            return;

        if (event.kind === "app_session_started") {
            if (sessionStartedGeneration === generation)
                return;

            sessionStartedGeneration = generation;
        }

        queue.push({ outbound, queuedAt: now(), retries: 0 });
        schedule(generation);
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
        if (currentGeneration !== undefined && currentGeneration === generation)
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

            if (current.enabled || !supported || disposed)
                return current;

            updateRuntimeSettings(runtimePath, (runtime) => ({ ...runtime, telemetry: { consent: "granted", installationId: randomUUID() } }));
            generation += 1;
            capture({ kind: "app_session_started" });

            return consent();
        },
        capture,
        dispose: () => {
            disposed = true;
            stop();
        },
    };
}
