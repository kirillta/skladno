export const telemetrySchemaVersion = 1;

export type TelemetryFailureCategory = "configuration" | "network" | "persistence" | "cancelled" | "unknown";
export type TelemetryOperation = "assistant" | "thesis_to_narrative" | "flow_revision" | "fact_check" | "style_review" | "translation";

export type TelemetryEvent =
    | { kind: "app_session_started" }
    | { kind: "ai_operation_finished"; operation: TelemetryOperation; outcome: "completed" | "failed" | "cancelled"; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "proposal_reviewed"; decision: "accepted" | "rejected" }
    | { kind: "draft_checkpoint_finished"; attempts: number; successes: number; failures: number; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "backup_finished"; outcome: "completed" | "failed"; elapsedMs: number; failure?: TelemetryFailureCategory }
    | { kind: "recovery_finished"; recovery: "restore" | "revision"; outcome: "completed" | "failed"; failure?: TelemetryFailureCategory }
    | { kind: "app_failure"; failure: TelemetryFailureCategory };


export interface TelemetryConsent {
    enabled: boolean;
    supported: boolean;
    installationId?: string;
}


export interface DesktopTelemetryClient {
    getTelemetryConsent(): Promise<TelemetryConsent>;
    setTelemetryConsent(enabled: boolean): Promise<TelemetryConsent>;
    captureTelemetry(event: TelemetryEvent): Promise<void>;
}


function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}


function hasOnly(record: Record<string, unknown>, keys: readonly string[]): boolean {
    return Object.keys(record).every((key) => keys.includes(key));
}


function isCount(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}


function isDuration(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 86_400_000;
}


export function isTelemetryFailureCategory(value: unknown): value is TelemetryFailureCategory {
    return value === "configuration" || value === "network" || value === "persistence" || value === "cancelled" || value === "unknown";
}


export function isTelemetryEvent(value: unknown): value is TelemetryEvent {
    const candidate = record(value);
    if (!candidate || typeof candidate.kind !== "string")
        return false;

    switch (candidate.kind) {
        case "app_session_started":
            return hasOnly(candidate, ["kind"]);
        case "proposal_reviewed":
            return hasOnly(candidate, ["kind", "decision"]) && (candidate.decision === "accepted" || candidate.decision === "rejected");
        case "app_failure":
            return hasOnly(candidate, ["kind", "failure"]) && isTelemetryFailureCategory(candidate.failure);
        case "ai_operation_finished":
            return hasOnly(candidate, ["kind", "operation", "outcome", "elapsedMs", "failure"])
                && (candidate.operation === "assistant" || candidate.operation === "thesis_to_narrative" || candidate.operation === "flow_revision" || candidate.operation === "fact_check" || candidate.operation === "style_review" || candidate.operation === "translation")
                && (candidate.outcome === "completed" || candidate.outcome === "failed" || candidate.outcome === "cancelled")
                && isDuration(candidate.elapsedMs)
                && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
        case "draft_checkpoint_finished":
            return hasOnly(candidate, ["kind", "attempts", "successes", "failures", "elapsedMs", "failure"])
                && isCount(candidate.attempts) && isCount(candidate.successes) && isCount(candidate.failures) && candidate.successes + candidate.failures <= candidate.attempts
                && isDuration(candidate.elapsedMs) && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
        case "backup_finished":
            return hasOnly(candidate, ["kind", "outcome", "elapsedMs", "failure"])
                && (candidate.outcome === "completed" || candidate.outcome === "failed") && isDuration(candidate.elapsedMs)
                && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
        case "recovery_finished":
            return hasOnly(candidate, ["kind", "recovery", "outcome", "failure"])
                && (candidate.recovery === "restore" || candidate.recovery === "revision") && (candidate.outcome === "completed" || candidate.outcome === "failed")
                && (candidate.failure === undefined || isTelemetryFailureCategory(candidate.failure));
        default:
            return false;
    }
}
