import { mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { beginTimedTelemetryCapture, type DesktopUpdateState, type TelemetryCaptureSource } from "@skladno/shared";
import { readRuntimeSettings, updateRuntimeSettings, writeRuntimeSettings, type RuntimeSettings } from "../../infrastructure/runtime/runtime-settings.js";
import { getAvailableUpdateState, getNewestCompatibleRelease, updatePreferences, type Release } from "./desktop-update-releases.js";

const releasesUrl = "https://api.github.com/repos/kirillta/skladno/releases";
const releasesDownloadUrl = "https://github.com/kirillta/skladno/releases/download";
const recoveryGuideUrl = "https://github.com/kirillta/skladno/blob/main/docs/user/update-recovery.md";
const automaticUpdateCheckInitialDelay = 5_000;
const automaticUpdateCheckInterval = 86_400_000;


interface NativeUpdater {
    setFeedURL(options: { url: string }): void;
    checkForUpdates(): void;
    quitAndInstall(): void;
    on(event: "update-downloaded" | "error", listener: () => void): void;
}


interface DesktopUpdateRuntime {
    runtimePath: string;
    currentVersion: string;
    supported: boolean;
    platform: "linux" | "win32";
}


interface DesktopUpdateReleaseSource {
    fetchReleases?: () => Promise<Response>;
    openExternal(url: string): Promise<void>;
}


interface DesktopUpdateExecution {
    database: { exec(sql: string): void };
    dataDirectory: string;
    updater: NativeUpdater;
    requestCheckpoint(): Promise<boolean>;
    closeApplication(): void;
    telemetry?: TelemetryCaptureSource;
}


interface DesktopUpdatePresentation {
    notify(state: DesktopUpdateState): void;
    scheduleTimeout?: (callback: () => void | Promise<void>, delay: number) => unknown;
}


function createUpdateSnapshot(database: { exec(sql: string): void }, directory: string, priorVersion: string, telemetry?: TelemetryCaptureSource): string {
    const observed = beginTimedTelemetryCapture(telemetry);
    try {
        mkdirSync(directory, { recursive: true });
        const path = join(directory, `skladno-before-${priorVersion}.sqlite`);
        const temporary = `${path}.tmp`;
        database.exec(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
        renameSync(temporary, path);

        if (statSync(path).size === 0)
            throw new Error("Update snapshot is empty.");

        observed.capture({ kind: "backup_finished", outcome: "completed", elapsedMs: observed.elapsedMs() });
        return path;
    } catch (error) {
        observed.capture({ kind: "backup_finished", outcome: "failed", elapsedMs: observed.elapsedMs(), failure: "unknown" });
        throw error;
    }
}


export function createDesktopUpdateCoordinator(runtime: DesktopUpdateRuntime, source: DesktopUpdateReleaseSource, execution: DesktopUpdateExecution, presentation: DesktopUpdatePresentation) {
    const { runtimePath, currentVersion, supported, platform } = runtime;
    const { fetchReleases = () => fetch(releasesUrl), openExternal } = source;
    const { database, dataDirectory, updater, requestCheckpoint, closeApplication, telemetry } = execution;
    const { notify, scheduleTimeout = setTimeout } = presentation;
    let release: Release | undefined;
    let state: DesktopUpdateState = getInitialUpdateState();


    function readCurrentRuntimeSettings(): RuntimeSettings {
        return readRuntimeSettings(runtimePath);
    }


    function getInitialUpdateState(): DesktopUpdateState {
        const runtime = readCurrentRuntimeSettings();
        if (!supported)
            return { kind: "unsupported", currentVersion, ...updatePreferences(runtime, currentVersion) };

        return {
            kind: "current",
            currentVersion,
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            ...updatePreferences(runtime, currentVersion)
        };
    }


    function setState(next: DesktopUpdateState): DesktopUpdateState {
        state = next;
        notify(next);
        return next;
    }


    async function checkNow(): Promise<DesktopUpdateState> {
        if (state.kind === "unsupported")
            return state;

        const runtime = readCurrentRuntimeSettings();
        if (runtime.updateNetworkAccess !== true)
            return setState({
                kind: "current",
                currentVersion,
                ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
                ...updatePreferences(runtime, currentVersion)
            });

        setState({
            kind: "checking",
            currentVersion,
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            ...updatePreferences(runtime, currentVersion)
        });

        try {
            const response = await fetchReleases();
            const payload: unknown = await response.json();
            if (!response.ok || !Array.isArray(payload))
                throw new Error("Release discovery failed.");

            release = getNewestCompatibleRelease(payload, currentVersion, runtime, platform);
            const nextRuntime = updateRuntimeSettings(runtimePath, (current) => ({ ...current, lastUpdateCheckAt: new Date().toISOString() }));
            return release
                ? setState(getAvailableUpdateState(release, currentVersion, nextRuntime, platform === "win32"))
                : setState({ kind: "current", currentVersion, lastCheckedAt: nextRuntime.lastUpdateCheckAt, ...updatePreferences(nextRuntime, currentVersion) });
        } catch {
            return setState({
                kind: "failed",
                currentVersion,
                error: "discovery_failed",
                ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
                ...updatePreferences(runtime, currentVersion)
            });
        }
    }


    updater.on("update-downloaded", () => {
        if (state.kind === "downloading") {
            const runtime = { ...readCurrentRuntimeSettings(), stagedUpdateVersion: state.version };
            writeRuntimeSettings(runtimePath, runtime);
            setState({ ...state, kind: "ready" });
        }
    });
    updater.on("error", () => {
        const runtime = readCurrentRuntimeSettings();
        setState({
            kind: "failed",
            currentVersion,
            error: state.kind === "downloading" ? "download_failed" : "apply_failed",
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            ...updatePreferences(runtime, currentVersion)
        });
    });

    return {
        getState: () => state,
        setNetworkAccess(enabled: boolean) {
            const runtime = { ...readCurrentRuntimeSettings(), updateNetworkAccess: enabled };
            writeRuntimeSettings(runtimePath, runtime);
            if (state.kind === "unsupported")
                return setState({ ...state, networkAccess: enabled });

            return setState({
                kind: "current",
                currentVersion,
                ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
                ...updatePreferences(runtime, currentVersion)
            });
        },
        setAutomaticChecks(enabled: boolean) {
            const runtime = { ...readCurrentRuntimeSettings(), automaticUpdateChecks: enabled };
            writeRuntimeSettings(runtimePath, runtime);
            if (state.kind === "unsupported")
                return setState({ ...state, automaticChecks: enabled });

            return setState({ ...state, automaticChecks: enabled });
        },
        setIncludePrereleases(enabled: boolean) {
            const runtime = { ...readCurrentRuntimeSettings(), includePrereleaseUpdates: enabled };
            writeRuntimeSettings(runtimePath, runtime);
            if (enabled || !release?.prerelease || state.kind !== "available")
                return setState({ ...state, includePrereleases: enabled });

            release = undefined;
            return setState({
                kind: "current",
                currentVersion,
                ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
                ...updatePreferences(runtime, currentVersion)
            });
        },
        checkNow,
        download(): DesktopUpdateState {
            if (!release || state.kind !== "available" || !state.downloadable)
                return state;

            const downloading = { ...state, kind: "downloading" as const };
            setState(downloading);
            updater.setFeedURL({ url: `${releasesDownloadUrl}/${release.tag_name}` });
            updater.checkForUpdates();
            return downloading;
        },
        async restartAndUpdate(): Promise<boolean> {
            if (state.kind !== "ready" || !await requestCheckpoint())
                return false;

            try {
                const snapshot = createUpdateSnapshot(database, join(dataDirectory, "update-recovery"), currentVersion, telemetry);
                writeRuntimeSettings(runtimePath, { ...readCurrentRuntimeSettings(), priorVersion: currentVersion, recoverySnapshotPath: snapshot, startupSuccess: false });
                closeApplication();
                updater.quitAndInstall();
                return true;
            } catch {
                setState({ kind: "failed", currentVersion, error: "apply_failed", ...updatePreferences(readCurrentRuntimeSettings(), currentVersion) });
                return false;
            }
        },
        openReleaseNotes: () => state.kind === "available" || state.kind === "downloading" || state.kind === "ready" ? openExternal(state.releaseNotesUrl) : Promise.resolve(),
        openRecoveryGuide: () => openExternal(recoveryGuideUrl),
        schedule() {
            async function runAutomaticUpdateCheck(): Promise<void> {
                const runtime = readCurrentRuntimeSettings();
                if (state.kind === "unsupported" || runtime.updateNetworkAccess !== true || runtime.automaticUpdateChecks === false)
                    return;

                await checkNow();
                scheduleTimeout(runAutomaticUpdateCheck, automaticUpdateCheckInterval);
            }


            scheduleTimeout(runAutomaticUpdateCheck, automaticUpdateCheckInitialDelay);
        },
        markStartupSuccessful() {
            const runtime = readCurrentRuntimeSettings();
            if (runtime.startupSuccess === false)
                writeRuntimeSettings(runtimePath, { ...runtime, startupSuccess: true });
        },
    };
}
