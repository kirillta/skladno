import type { IpcMain, IpcRenderer } from "electron";
import { ApplicationClientError, isTelemetryEvent, type ApplicationErrorCode, type DesktopTelemetryClient, type TelemetryConsent, type TelemetryEvent } from "@skladno/shared";

export const desktopTelemetryChannel = "skladno:desktop-telemetry";


function isTelemetryConsent(value: unknown): value is TelemetryConsent {
    if (!value || typeof value !== "object")
        return false;

    const candidate = value as Record<string, unknown>;
    return typeof candidate.enabled === "boolean"
        && typeof candidate.supported === "boolean"
        && (candidate.installationId === undefined || typeof candidate.installationId === "string");
}


function request(value: unknown): { method: "getConsent" } | { method: "setConsent"; enabled: boolean } | { method: "beginCapture" } | { method: "capture"; event: TelemetryEvent; generation?: number } | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const candidate = value as Record<string, unknown>;
    if (candidate.method === "getConsent" && Object.keys(candidate).every((key) => key === "method"))
        return { method: "getConsent" };

    if (candidate.method === "setConsent" && typeof candidate.enabled === "boolean" && Object.keys(candidate).every((key) => key === "method" || key === "enabled"))
        return { method: "setConsent", enabled: candidate.enabled };

    if (candidate.method === "beginCapture" && Object.keys(candidate).every((key) => key === "method"))
        return { method: "beginCapture" };

    const generation = candidate.generation;
    if (candidate.method === "capture" && isTelemetryEvent(candidate.event) && (generation === undefined || typeof generation === "number" && Number.isSafeInteger(generation) && generation >= 0) && Object.keys(candidate).every((key) => key === "method" || key === "event" || key === "generation"))
        return { method: "capture", event: candidate.event, ...(generation === undefined ? {} : { generation }) };

    return undefined;
}


export function registerDesktopTelemetryAdapter({ ipcMain, isAuthorizedSender, telemetry }: {
    ipcMain: IpcMain;
    isAuthorizedSender(event: { sender: unknown }): boolean;
    telemetry: ReturnType<typeof import("../infrastructure/telemetry-owner.js").createTelemetryOwner>;
}): void {
    ipcMain.handle(desktopTelemetryChannel, async (event, input: unknown) => {
        if (!isAuthorizedSender(event))
            return { ok: false, error: "invalid_request" };

        const parsed = request(input);
        if (!parsed)
            return { ok: false, error: "invalid_request" };

        try {
            switch (parsed.method) {
                case "getConsent":
                    return { ok: true, value: telemetry.getConsent() };
                case "setConsent":
                    return { ok: true, value: telemetry.setConsent(parsed.enabled) };
                case "beginCapture":
                    return { ok: true, value: telemetry.beginCaptureGeneration() };
                case "capture":
                    telemetry.captureAtGeneration(parsed.event, parsed.generation);
                    return { ok: true, value: undefined };
                default: {
                    const _exhaustive: never = parsed;
                    return _exhaustive;
                }
            }
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}


export function createDesktopTelemetryClient(ipcRenderer: Pick<IpcRenderer, "invoke">): DesktopTelemetryClient {
    async function invoke<T>(input: unknown): Promise<T> {
        const result = await ipcRenderer.invoke(desktopTelemetryChannel, input) as { ok: boolean; value?: T; error?: ApplicationErrorCode };
        if (!result.ok)
            throw new ApplicationClientError(result.error ?? "editorial_request_failed", undefined, 500);

        return result.value as T;
    }


    return {
        getTelemetryConsent: async () => {
            const value = await invoke<TelemetryConsent>({ method: "getConsent" });
            if (!isTelemetryConsent(value))
                throw new ApplicationClientError("editorial_request_failed", undefined, 500);

            return value;
        },
        setTelemetryConsent: async (enabled) => {
            const value = await invoke<TelemetryConsent>({ method: "setConsent", enabled });
            if (!isTelemetryConsent(value))
                throw new ApplicationClientError("editorial_request_failed", undefined, 500);

            return value;
        },
        beginTelemetryCapture: async () => {
            const value = await invoke<number | undefined>({ method: "beginCapture" });
            if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
                throw new ApplicationClientError("editorial_request_failed", undefined, 500);

            return value;
        },
        captureTelemetry: (event, generation) => invoke<void>({ method: "capture", event, ...(generation === undefined ? {} : { generation }) }),
    };
}
