import { readFileSync } from "node:fs";
import { release } from "node:os";
import { isTelemetryEvent, telemetrySchemaVersion, type TelemetryEvent } from "@skladno/shared";

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
    readonly outbound: OutboundEvent;
    readonly queuedAt: number;
    readonly retries: number;
}


interface ActiveRequest {
    readonly controller: AbortController;
    readonly generation: number;
    readonly batchSize: number;
}


interface DeliveryState {
    readonly generation: number;
    readonly queue: readonly QueuedEvent[];
    readonly timer: ReturnType<typeof setTimeout> | undefined;
    readonly activeRequest: ActiveRequest | undefined;
    readonly disposed: boolean;
    readonly rateWindowStartedAt: number;
    readonly acceptedInRateWindow: number;
}


export interface TelemetryDelivery {
    readonly supported: boolean;
    capture(event: TelemetryEvent, installationId: string): boolean;
    stop(): void;
}


interface TelemetryDeliveryEnvironment {
    readonly fetch?: typeof fetch;
    readonly scheduleTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    readonly clearScheduledTimeout?: (timeout: ReturnType<typeof setTimeout>) => void;
    readonly now?: () => number;
    readonly requestTimeout?: number;
}


function parseTelemetryDeliveryConfiguration(value: { endpoint?: string; projectKey?: string }): DeliveryConfiguration | undefined {
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


function createOutboundTelemetryEvent(event: TelemetryEvent, installationId: string, appVersion: string, osVersion: string): OutboundEvent | undefined {
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


export function createTelemetryDelivery({ packaged, appVersion, delivery, osVersion = release(), environment = {} }: {
    packaged: boolean;
    appVersion: string;
    delivery?: { endpoint?: string; projectKey?: string };
    osVersion?: string;
    environment?: TelemetryDeliveryEnvironment;
}): TelemetryDelivery {
    const { fetch: fetchImplementation = fetch, scheduleTimeout = setTimeout, clearScheduledTimeout = clearTimeout, now = Date.now, requestTimeout = requestTimeoutMs } = environment;
    const deliveryConfiguration = packaged ? parseTelemetryDeliveryConfiguration(delivery ?? {}) : undefined;
    const supported = Boolean(deliveryConfiguration);
    let state: DeliveryState = {
        generation: 0,
        queue: [],
        timer: undefined,
        activeRequest: undefined,
        disposed: false,
        rateWindowStartedAt: now(),
        acceptedInRateWindow: 0,
    };


    function stop(): void {
        const { activeRequest, timer } = state;
        state = {
            ...state,
            generation: state.generation + 1,
            queue: [],
            timer: undefined,
            activeRequest: undefined,
        };
        activeRequest?.controller.abort();
        if (timer !== undefined)
            clearScheduledTimeout(timer);
    }


    function schedule(currentGeneration: number, delay = flushDelayMs): void {
        if (state.disposed || currentGeneration !== state.generation || !state.queue.length || state.timer !== undefined)
            return;

        state = { ...state, timer: scheduleTimeout(() => void flush(currentGeneration), delay) };
    }


    function retainedCount(): number {
        return state.queue.length + (state.activeRequest?.generation === state.generation ? state.activeRequest.batchSize : 0);
    }


    function withinRateLimit(): boolean {
        const current = now();
        const windowExpired = current - state.rateWindowStartedAt >= eventRateWindowMs;
        const windowStartedAt = windowExpired ? current : state.rateWindowStartedAt;
        const acceptedInRateWindow = windowExpired ? 0 : state.acceptedInRateWindow;

        if (acceptedInRateWindow >= eventRateLimit)
            return false;

        state = { ...state, rateWindowStartedAt: windowStartedAt, acceptedInRateWindow: acceptedInRateWindow + 1 };
        return true;
    }


    async function flush(currentGeneration = state.generation): Promise<void> {
        state = { ...state, timer: undefined };
        if (state.disposed || currentGeneration !== state.generation || !deliveryConfiguration || !state.queue.length || state.activeRequest)
            return;

        const startedAt = now();
        const batch = state.queue.filter((entry) => startedAt - entry.queuedAt <= eventExpiryMs);
        state = { ...state, queue: [] };
        if (!batch.length) {
            schedule(currentGeneration);
            return;
        }

        const controller = new AbortController();
        state = { ...state, activeRequest: { controller, generation: currentGeneration, batchSize: batch.length } };
        const timeout = setTimeout(() => controller.abort(), requestTimeout);
        const { retry, delay } = await (async () => {
            try {
                const response = await fetchImplementation(deliveryConfiguration.endpoint, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ api_key: deliveryConfiguration.projectKey, batch: batch.map((entry) => entry.outbound) }),
                    signal: controller.signal,
                    redirect: "manual",
                });
                return {
                    retry: response.status === 429 || response.status >= 500,
                    delay: response.status === 429 ? retryAfter(response) : retryDelayMs,
                };
            } catch {
                return { retry: true, delay: retryDelayMs };
            }
        })();

        clearTimeout(timeout);
        if (state.activeRequest?.controller === controller)
            state = { ...state, activeRequest: undefined };

        if (!state.disposed && currentGeneration === state.generation && retry) {
            const retried = batch
                .filter((entry) => entry.retries < maxRetries && now() - entry.queuedAt <= eventExpiryMs)
                .map((entry) => ({ ...entry, retries: entry.retries + 1 }));
            state = { ...state, queue: [...retried, ...state.queue] };
        }

        schedule(currentGeneration, retry ? delay : flushDelayMs);
    }


    function capture(event: TelemetryEvent, installationId: string): boolean {
        if (state.disposed || !supported || retainedCount() >= queueLimit)
            return false;

        const outbound = createOutboundTelemetryEvent(event, installationId, appVersion, osVersion);
        if (!outbound || !withinRateLimit())
            return false;

        state = { ...state, queue: [...state.queue, { outbound, queuedAt: now(), retries: 0 }] };
        schedule(state.generation);
        return true;
    }


    return { supported, capture, stop };
}
