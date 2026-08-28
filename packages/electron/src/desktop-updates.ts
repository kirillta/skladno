import { mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import type { IpcMain, IpcRenderer } from "electron";
import { ApplicationClientError, isDesktopUpdateState, type ApplicationErrorCode, type DesktopUpdateClient, type DesktopUpdateState } from "@skladno/shared";
import { readRuntimeSettings, writeRuntimeSettings, type RuntimeSettings } from "./runtime-settings.js";

export const desktopUpdatesChannel = "skladno:desktop-updates";
export const desktopUpdatesEvent = "skladno:desktop-updates:state";
const releasesUrl = "https://api.github.com/repos/kirillta/skladno/releases";
const releasesDownloadUrl = "https://github.com/kirillta/skladno/releases/download";
const recoveryGuideUrl = "https://github.com/kirillta/skladno/blob/main/docs/user/update-recovery.md";
const previewTag = /^v(\d+)\.(\d+)\.(\d+)-preview\.(\d+)(\.security)?$/;
const previewVersion = /^v?(\d+)\.(\d+)\.(\d+)-preview\.(\d+)(\.security)?$/;


interface Release {
    tag_name: string;
    name?: string;
    body?: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
    assets: { name: string }[];
}


interface NativeUpdater {
    setFeedURL(options: { url: string }): void;
    checkForUpdates(): void;
    quitAndInstall(): void;
    on(event: "update-downloaded" | "error", listener: () => void): void;
}


function versionParts(value: string): number[] | undefined {
    const match = previewVersion.exec(value);
    return match ? match.slice(1, 5).map(Number) : undefined;
}


function newerThan(candidate: string, current: string): boolean {
    const left = versionParts(candidate);
    const right = versionParts(current);
    if (!left || !right)
        return false;

    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index])
            return left[index]! > right[index]!;
    }

    return false;
}


function supportedRelease(value: unknown): value is Release {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;

    const release = value as Record<string, unknown>;

    return typeof release.tag_name === "string"
        && typeof release.html_url === "string"
        && typeof release.prerelease === "boolean"
        && typeof release.draft === "boolean"
        && Array.isArray(release.assets)
        && release.assets.every((asset) => asset && typeof asset === "object" && typeof (asset as Record<string, unknown>).name === "string");
}


function releaseState(release: Release, currentVersion: string, settings: RuntimeSettings): Extract<DesktopUpdateState, { kind: "available" | "downloading" | "ready" }> {
    const match = previewTag.exec(release.tag_name)!;
    return {
        kind: "available",
        currentVersion,
        version: match[0].slice(1),
        title: typeof release.name === "string" && release.name ? release.name : `Skladno ${match[0]}`,
        summary: typeof release.body === "string" ? release.body.replace(/<[^>]*>/g, "").trim().slice(0, 1000) : "",
        releaseNotesUrl: release.html_url,
        security: match[5] === ".security",
        ...(settings.lastUpdateCheckAt ? { lastCheckedAt: settings.lastUpdateCheckAt } : {}),
        automaticChecks: settings.automaticUpdateChecks !== false,
    };
}


function createUpdateSnapshot(database: { exec(sql: string): void }, directory: string, priorVersion: string): string {
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `skladno-before-${priorVersion}.sqlite`);
    const temporary = `${path}.tmp`;
    database.exec(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
    renameSync(temporary, path);

    if (statSync(path).size === 0)
        throw new Error("Update snapshot is empty.");

    return path;
}


export function createDesktopUpdateCoordinator({ runtimePath, currentVersion, database, dataDirectory, updater, fetchReleases = () => fetch(releasesUrl), notify, requestCheckpoint, closeApplication, openExternal, supported = true }: {
    runtimePath: string;
    currentVersion: string;
    database: { exec(sql: string): void };
    dataDirectory: string;
    updater: NativeUpdater;
    fetchReleases?: () => Promise<Response>;
    notify(state: DesktopUpdateState): void;
    requestCheckpoint(): Promise<boolean>;
    closeApplication(): void;
    openExternal(url: string): Promise<void>;
    supported?: boolean;
}) {
    let release: Release | undefined;
    let state: DesktopUpdateState = initialState();


    function settings(): RuntimeSettings {
        return readRuntimeSettings(runtimePath);
    }


    function initialState(): DesktopUpdateState {
        const runtime = readRuntimeSettings(runtimePath);
        if (!supported)
            return { kind: "unsupported", currentVersion, automaticChecks: runtime.automaticUpdateChecks !== false };

        return {
            kind: "current",
            currentVersion,
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            automaticChecks: runtime.automaticUpdateChecks !== false
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

        const runtime = settings();
        setState({
            kind: "checking",
            currentVersion,
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            automaticChecks: runtime.automaticUpdateChecks !== false
        });

        try {
            const response = await fetchReleases();
            const payload: unknown = await response.json();
            if (!response.ok || !Array.isArray(payload))
                throw new Error("Release discovery failed.");

            const candidates = payload.filter(supportedRelease)
                .filter((item) => item.prerelease
                    && !item.draft
                    && previewTag.test(item.tag_name)
                    && item.assets.some((asset) => asset.name === "RELEASES")
                    && item.assets.some((asset) => /-full\.nupkg$/i.test(asset.name))
                );

            release = candidates.sort((first, second) => newerThan(first.tag_name, second.tag_name) ? -1 : 1).find((item) => newerThan(item.tag_name, currentVersion));
            const nextRuntime = { ...runtime, lastUpdateCheckAt: new Date().toISOString() };
            writeRuntimeSettings(runtimePath, nextRuntime);
            if (!release)
                return setState({ kind: "current", currentVersion, lastCheckedAt: nextRuntime.lastUpdateCheckAt, automaticChecks: nextRuntime.automaticUpdateChecks !== false });

            return setState(releaseState(release, currentVersion, nextRuntime));
        } catch {
            return setState({
                kind: "failed",
                currentVersion,
                error: "discovery_failed",
                ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
                automaticChecks: runtime.automaticUpdateChecks !== false
            });
        }
    }


    updater.on("update-downloaded", () => {
        if (state.kind === "downloading") {
            const runtime = { ...settings(), stagedUpdateVersion: state.version };
            writeRuntimeSettings(runtimePath, runtime);
            setState({ ...state, kind: "ready" });
        }
    });
    updater.on("error", () => {
        const runtime = settings();
        setState({
            kind: "failed",
            currentVersion,
            error: state.kind === "downloading" ? "download_failed" : "apply_failed",
            ...(runtime.lastUpdateCheckAt ? { lastCheckedAt: runtime.lastUpdateCheckAt } : {}),
            automaticChecks: runtime.automaticUpdateChecks !== false
        });
    });

    return {
        getState: () => state,
        setAutomaticChecks(enabled: boolean) {
            const runtime = { ...settings(), automaticUpdateChecks: enabled };
            writeRuntimeSettings(runtimePath, runtime);
            if (state.kind === "unsupported")
                return setState({ ...state, automaticChecks: enabled });

            return setState({ ...state, automaticChecks: enabled });
        },
        checkNow,
        download(): DesktopUpdateState {
            if (!release || state.kind !== "available")
                return state;

            const downloading = { ...state, kind: "downloading" as const };
            setState(downloading);
            updater.setFeedURL({ url: `${releasesDownloadUrl}/${release.tag_name}` });
            updater.checkForUpdates();

            return downloading;
        },
        async restartAndUpdate(): Promise<boolean> {
            if (state.kind !== "ready")
                return false;

            if (!await requestCheckpoint())
                return false;

            try {
                const snapshot = createUpdateSnapshot(database, join(dataDirectory, "update-recovery"), currentVersion);
                writeRuntimeSettings(runtimePath, { ...settings(), priorVersion: currentVersion, recoverySnapshotPath: snapshot, startupSuccess: false });
                closeApplication();
                updater.quitAndInstall();

                return true;
            } catch {
                setState({ kind: "failed", currentVersion, error: "apply_failed", automaticChecks: settings().automaticUpdateChecks !== false });
                return false;
            }
        },
        openReleaseNotes: () => state.kind === "available" || state.kind === "downloading" || state.kind === "ready" ? openExternal(state.releaseNotesUrl) : Promise.resolve(),
        openRecoveryGuide: () => openExternal(recoveryGuideUrl),
        schedule() {
            const runtime = settings();
            if (state.kind === "unsupported" || runtime.automaticUpdateChecks === false || (runtime.lastUpdateCheckAt && Date.now() - Date.parse(runtime.lastUpdateCheckAt) < 86_400_000))
                return;

            setTimeout(() => void checkNow(), 5_000);
        },
        markStartupSuccessful() {
            const runtime = settings();
            if (runtime.startupSuccess === false)
                writeRuntimeSettings(runtimePath, { ...runtime, startupSuccess: true });
        },
    };
}


export function registerDesktopUpdatesAdapter({ ipcMain, coordinator }: { ipcMain: IpcMain; coordinator: ReturnType<typeof createDesktopUpdateCoordinator> }): void {
    ipcMain.handle(desktopUpdatesChannel, async (_event, request: unknown) => {
        const method = request && typeof request === "object" ? (request as Record<string, unknown>).method : undefined;
        try {
            switch (method) {
                case "getState": return { ok: true, value: coordinator.getState() };
                case "setAutomaticChecks":
                    return typeof (request as Record<string, unknown>).enabled === "boolean"
                        ? { ok: true, value: coordinator.setAutomaticChecks((request as Record<string, boolean>).enabled) }
                        : { ok: false, error: "invalid_request" };
                case "checkNow": return { ok: true, value: await coordinator.checkNow() };
                case "download": return { ok: true, value: coordinator.download() };
                case "restartAndUpdate":
                    await coordinator.restartAndUpdate();
                    return { ok: true, value: undefined };
                case "openReleaseNotes":
                    await coordinator.openReleaseNotes();
                    return { ok: true, value: undefined };
                case "openRecoveryGuide":
                    await coordinator.openRecoveryGuide();
                    return { ok: true, value: undefined };
                case "rendererReady":
                    coordinator.markStartupSuccessful();
                    return { ok: true, value: undefined };
                default: return { ok: false, error: "invalid_request" };
            }
        } catch {
            return { ok: false, error: "editorial_request_failed" };
        }
    });
}


export function createDesktopUpdateClient(ipcRenderer: Pick<IpcRenderer, "invoke" | "on" | "removeListener">): DesktopUpdateClient {
    async function invoke<T>(method: string, enabled?: boolean): Promise<T> {
        const result = await ipcRenderer.invoke(desktopUpdatesChannel, { method, ...(enabled === undefined ? {} : { enabled }) }) as { ok: boolean; value?: T; error?: ApplicationErrorCode };
        if (!result.ok)
            throw new ApplicationClientError(result.error ?? "editorial_request_failed", undefined, 500);

        if (method !== "restartAndUpdate" && method !== "openReleaseNotes" && method !== "openRecoveryGuide" && !isDesktopUpdateState(result.value))
            throw new ApplicationClientError("editorial_request_failed", undefined, 500);

        return result.value as T;
    }


    return {
        getState: () => invoke("getState"), setAutomaticChecks: (enabled) => invoke("setAutomaticChecks", enabled), checkNow: () => invoke("checkNow"), download: () => invoke("download"), restartAndUpdate: () => invoke("restartAndUpdate"), openReleaseNotes: () => invoke("openReleaseNotes"), openRecoveryGuide: () => invoke("openRecoveryGuide"), rendererReady: () => invoke("rendererReady"),
        subscribe(listener) {
            const receive = (_event: unknown, state: unknown) => {
                if (isDesktopUpdateState(state))
                    listener(state);
            };
            ipcRenderer.on(desktopUpdatesEvent, receive);

            return () => ipcRenderer.removeListener(desktopUpdatesEvent, receive);
        },
    };
}
