export const telemetrySchemaVersion = 1;

export type TelemetryFailureCategory = "configuration" | "network" | "persistence" | "cancelled" | "unknown";
export type TelemetryOperation = "assistant" | "thesis_to_narrative" | "flow_revision" | "fact_check" | "style_review" | "translation";
export type TelemetryTermination = "crashed" | "killed" | "oom" | "launch_failed" | "integrity_failure" | "abnormal_exit";

export type TelemetryEvent =
    | { kind: "app_session_started" }
    | { kind: "ai_operation_finished"; operation: TelemetryOperation; outcome: "completed" | "failed" | "cancelled"; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "proposal_reviewed"; decision: "accepted" | "rejected" }
    | { kind: "draft_checkpoint_finished"; attempts: number; successes: number; failures: number; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "backup_finished"; outcome: "completed" | "failed"; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "recovery_finished"; recovery: "restore" | "revision"; outcome: "completed" | "failed"; failure?: TelemetryFailureCategory }
    | { kind: "app_failure"; source: "startup"; failure: TelemetryFailureCategory }
    | { kind: "app_failure"; source: "renderer" | "child_process"; failure: TelemetryFailureCategory; termination: TelemetryTermination };


export type TelemetryCapture = (event: TelemetryEvent) => void;


export interface TelemetryCaptureSource {
    beginCapture(): TelemetryCapture;
}


export interface TimedTelemetryCapture {
    capture: TelemetryCapture;
    elapsedMs(): number;
}


const createNoTelemetryCapture: TelemetryCapture = () => undefined;


export function beginTelemetryCapture(source?: TelemetryCaptureSource): TelemetryCapture {
    return source?.beginCapture() ?? createNoTelemetryCapture;
}


export function beginTimedTelemetryCapture(source?: TelemetryCaptureSource): TimedTelemetryCapture {
    const startedAt = performance.now();
    return { capture: beginTelemetryCapture(source), elapsedMs: () => Math.round(performance.now() - startedAt) };
}


export interface TelemetryConsent {
    enabled: boolean;
    supported: boolean;
    installationId?: string;
}


export interface DesktopTelemetryClient {
    getTelemetryConsent(): Promise<TelemetryConsent>;
    setTelemetryConsent(enabled: boolean): Promise<TelemetryConsent>;
    beginTelemetryCapture(): Promise<number | undefined>;
    captureTelemetry(event: TelemetryEvent, generation?: number): Promise<void>;
}


function parseTelemetryRecord(value: unknown): Record<string, unknown> | undefined {
    return value !== null
        && typeof value === "object"
        && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}


function hasOnly(record: Record<string, unknown>, keys: readonly string[]): boolean {
    return Object.keys(record).every((key) => keys.includes(key));
}


function isCount(value: unknown): value is number {
    return typeof value === "number"
        && Number.isSafeInteger(value)
        && value >= 0
        && value <= 1_000_000;
}


function isDuration(value: unknown): value is number {
    return typeof value === "number"
        && Number.isFinite(value)
        && value >= 0
        && value <= 86_400_000;
}


export function isTelemetryFailureCategory(value: unknown): value is TelemetryFailureCategory {
    return value === "configuration"
        || value === "network"
        || value === "persistence"
        || value === "cancelled"
        || value === "unknown";
}


function isProcessFailure(candidate: Record<string, unknown>): boolean {
    return (candidate.source === "renderer" || candidate.source === "child_process")
        && hasOnly(candidate, ["kind", "source", "failure", "termination"])
        && (candidate.termination === "crashed" || candidate.termination === "killed" || candidate.termination === "oom"
            || candidate.termination === "launch_failed" || candidate.termination === "integrity_failure" || candidate.termination === "abnormal_exit");
}


function isAppFailure(candidate: Record<string, unknown>): boolean {
    return isTelemetryFailureCategory(candidate.failure)
        && (candidate.source === "startup" && hasOnly(candidate, ["kind", "source", "failure"]) || isProcessFailure(candidate));
}


function isAiOperationFinished(candidate: Record<string, unknown>): boolean {
    const operation = ["assistant", "thesis_to_narrative", "flow_revision", "fact_check", "style_review", "translation"];
    return hasOnly(candidate, ["kind", "operation", "outcome", "elapsedMs", "failure"])
        && operation.includes(String(candidate.operation))
        && (candidate.outcome === "completed" || candidate.outcome === "failed" || candidate.outcome === "cancelled")
        && isDuration(candidate.elapsedMs)
        && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
}


function isDraftCheckpointFinished(candidate: Record<string, unknown>): boolean {
    return hasOnly(candidate, ["kind", "attempts", "successes", "failures", "elapsedMs", "failure"])
        && isCount(candidate.attempts) && isCount(candidate.successes) && isCount(candidate.failures)
        && candidate.successes + candidate.failures <= candidate.attempts
        && isDuration(candidate.elapsedMs) && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
}


function isBackupFinished(candidate: Record<string, unknown>): boolean {
    return hasOnly(candidate, ["kind", "outcome", "elapsedMs", "failure"])
        && (candidate.outcome === "completed" || candidate.outcome === "failed") && isDuration(candidate.elapsedMs)
        && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
}


function isRecoveryFinished(candidate: Record<string, unknown>): boolean {
    return hasOnly(candidate, ["kind", "recovery", "outcome", "failure"])
        && (candidate.recovery === "restore" || candidate.recovery === "revision")
        && (candidate.outcome === "completed" || candidate.outcome === "failed")
        && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
}


export function isTelemetryEvent(value: unknown): value is TelemetryEvent {
    const candidate = parseTelemetryRecord(value);
    if (!candidate || typeof candidate.kind !== "string")
        return false;

    switch (candidate.kind) {
        case "app_session_started":
            return hasOnly(candidate, ["kind"]);
        case "proposal_reviewed":
            return hasOnly(candidate, ["kind", "decision"]) && (candidate.decision === "accepted" || candidate.decision === "rejected");
        case "app_failure":
            return isAppFailure(candidate);
        case "ai_operation_finished":
            return isAiOperationFinished(candidate);
        case "draft_checkpoint_finished":
            return isDraftCheckpointFinished(candidate);
        case "backup_finished":
            return isBackupFinished(candidate);
        case "recovery_finished":
            return isRecoveryFinished(candidate);
        default:
            return false;
    }
}
