import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isDesktopUpdateState } from "@skladno/shared";
import { createLegacyAnnouncementCoordinator } from "./legacy-announcement-coordinator.js";

// Product scenarios: application.electron-preview-update-discovery, application.electron-preview-update-recovery, application.electron-linux-release-discovery
test("final legacy build never discovers or applies releases and completes staged startup recovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-announcement-"));
    const runtimePath = join(root, "runtime.json");
    const forbidden = () => {
        throw new Error("Routine updater must remain inactive.");
    };
    const opened: string[] = [];
    try {
        writeFileSync(runtimePath, JSON.stringify({ startupSuccess: false, recoverySnapshotPath: "fixture.sqlite", updateNetworkAccess: true }));
        for (const platform of ["win32", "linux"] as const) {
            const coordinator = createLegacyAnnouncementCoordinator(
                { runtimePath, currentVersion: "0.5.6", supported: true, platform },
                { fetchReleases: forbidden, openExternal: async (url) => {
                    opened.push(url);
                } },
                { database: { exec: forbidden }, dataDirectory: root, updater: { setFeedURL: forbidden, checkForUpdates: forbidden, quitAndInstall: forbidden, on: forbidden }, requestCheckpoint: forbidden, closeApplication: forbidden },
                { notify: forbidden, scheduleTimeout: forbidden },
            );
            assert.equal(isDesktopUpdateState(coordinator.getState()), true);
            assert.equal((await coordinator.checkNow()).kind, "migration");
            assert.equal(coordinator.download().kind, "migration");
            assert.equal(await coordinator.restartAndUpdate(), false);
            coordinator.schedule();
            coordinator.setNetworkAccess(true);
            assert.equal(coordinator.getState().networkAccess, false);
            await coordinator.openReleaseNotes();
            coordinator.markStartupSuccessful();
        }

        assert.deepEqual(opened, Array(2).fill("https://main.dhsgh2xsr7g3j.amplifyapp.com/docs/migration.html"));
        const settings = JSON.parse(readFileSync(runtimePath, "utf8"));
        assert.equal(settings.startupSuccess, true);
        assert.equal(settings.recoverySnapshotPath, "fixture.sqlite");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
