export type DesktopUpdateState =
    | { kind: "unsupported"; currentVersion: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "current"; currentVersion: string; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "checking"; currentVersion: string; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "available"; currentVersion: string; version: string; title: string; summary: string; releaseNotesUrl: string; security: boolean; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "downloading"; currentVersion: string; version: string; title: string; summary: string; releaseNotesUrl: string; security: boolean; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "ready"; currentVersion: string; version: string; title: string; summary: string; releaseNotesUrl: string; security: boolean; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean }
    | { kind: "failed"; currentVersion: string; error: "discovery_failed" | "download_failed" | "apply_failed"; lastCheckedAt?: string; automaticChecks: boolean; networkAccess: boolean };


export interface DesktopUpdateClient {
    getState(): Promise<DesktopUpdateState>;
    setNetworkAccess(enabled: boolean): Promise<DesktopUpdateState>;
    setAutomaticChecks(enabled: boolean): Promise<DesktopUpdateState>;
    checkNow(): Promise<DesktopUpdateState>;
    download(): Promise<DesktopUpdateState>;
    restartAndUpdate(): Promise<void>;
    openReleaseNotes(): Promise<void>;
    openRecoveryGuide(): Promise<void>;
    rendererReady(): Promise<void>;
    subscribe(listener: (state: DesktopUpdateState) => void): () => void;
}


function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}


export function isDesktopUpdateState(value: unknown): value is DesktopUpdateState {
    if (!isRecord(value) || typeof value.kind !== "string")
        return false;

    if (typeof value.currentVersion !== "string" || typeof value.automaticChecks !== "boolean" || typeof value.networkAccess !== "boolean")
        return false;

    if (value.kind === "unsupported")
        return true;

    if (value.lastCheckedAt !== undefined && typeof value.lastCheckedAt !== "string")
        return false;

    if (value.kind === "current" || value.kind === "checking")
        return true;

    if (value.kind === "failed")
        return value.error === "discovery_failed" || value.error === "download_failed" || value.error === "apply_failed";

    return (value.kind === "available" || value.kind === "downloading" || value.kind === "ready")
        && typeof value.version === "string"
        && typeof value.title === "string"
        && typeof value.summary === "string"
        && typeof value.releaseNotesUrl === "string"
        && typeof value.security === "boolean";
}
