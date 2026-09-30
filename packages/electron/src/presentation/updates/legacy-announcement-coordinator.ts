import type { DesktopUpdateState } from "@skladno/shared";
import { readRuntimeSettings, writeRuntimeSettings } from "../../infrastructure/runtime/runtime-settings.js";
import type { createDesktopUpdateCoordinator } from "./desktop-update-coordinator.js";

const migrationUrl = "https://main.dhsgh2xsr7g3j.amplifyapp.com/docs/migration.html";


export function createLegacyAnnouncementCoordinator(...[runtime, source]: Parameters<typeof createDesktopUpdateCoordinator>): ReturnType<typeof createDesktopUpdateCoordinator> {
    const state: DesktopUpdateState = {
        kind: "migration", currentVersion: runtime.currentVersion,
        automaticChecks: false, includePrereleases: false, networkAccess: false,
        recoveryAvailable: runtime.platform === "win32",
    };
    return {
        getState: () => state,
        setNetworkAccess: () => state,
        setAutomaticChecks: () => state,
        setIncludePrereleases: () => state,
        checkNow: async () => state,
        download: () => state,
        restartAndUpdate: async () => false,
        openReleaseNotes: () => source.openExternal(migrationUrl),
        openRecoveryGuide: () => source.openExternal("https://warplyn.com/docs/update-recovery.html"),
        schedule() {
            // The final legacy build has no routine update checks.
        },
        markStartupSuccessful() {
            const settings = readRuntimeSettings(runtime.runtimePath);
            if (settings.startupSuccess === false)
                writeRuntimeSettings(runtime.runtimePath, { ...settings, startupSuccess: true });
        },
    };
}
