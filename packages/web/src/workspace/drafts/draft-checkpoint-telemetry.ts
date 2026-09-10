import type { DesktopTelemetryClient } from "@skladno/shared";
import { beginBestEffortTelemetryCapture, captureBestEffortTelemetry } from "../telemetry.js";


const flushDelayMs = 30_000;


interface CheckpointAggregate {
    generation: number;
    attempts: number;
    successes: number;
    failures: number;
    elapsedMs: number;
}


export function createDraftCheckpointTelemetry(client: DesktopTelemetryClient | undefined) {
    let aggregate: CheckpointAggregate | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;


    function flush(): void {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }

        const current = aggregate;
        aggregate = undefined;
        if (!current)
            return;

        const { generation, ...event } = current;
        captureBestEffortTelemetry(client, { kind: "draft_checkpoint_finished", ...event }, generation);
    }


    function record(generation: number | undefined, succeeded: boolean, elapsedMs: number): void {
        if (generation === undefined)
            return;

        if (aggregate && aggregate.generation !== generation)
            flush();

        aggregate ??= { generation, attempts: 0, successes: 0, failures: 0, elapsedMs: 0 };
        aggregate.attempts += 1;
        aggregate.successes += succeeded ? 1 : 0;
        aggregate.failures += succeeded ? 0 : 1;
        aggregate.elapsedMs = Math.min(86_400_000, aggregate.elapsedMs + Math.max(0, Math.round(elapsedMs)));
        timer ??= setTimeout(flush, flushDelayMs);
    }


    return {
        begin: () => beginBestEffortTelemetryCapture(client),
        record,
        dispose: () => {
            if (timer !== undefined)
                clearTimeout(timer);
        },
    };
}
