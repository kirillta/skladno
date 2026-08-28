import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDesktopUpdateCoordinator } from "./desktop-updates.js";

// Product scenarios: application.electron-preview-update-discovery, application.electron-preview-update-recovery
test("update discovery selects the newest complete Windows preview without downloading", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-updates-test-"));
    const runtimePath = join(root, "runtime-settings.json");
    writeFileSync(runtimePath, JSON.stringify({ updateNetworkAccess: true }));
    let checked = false;
    const coordinator = createDesktopUpdateCoordinator({
        runtimePath, currentVersion: "0.1.0-preview.1", database: { exec: () => undefined }, dataDirectory: root,
        updater: { setFeedURL: () => undefined, checkForUpdates: () => {
            checked = true;
        }, quitAndInstall: () => undefined, on: () => undefined },
        fetchReleases: async () => new Response(JSON.stringify([
            { tag_name: "v0.1.1-preview.1", html_url: "https://example.test/older", prerelease: true, draft: false, assets: [{ name: "RELEASES" }, { name: "Skladno-full.nupkg" }] },
            { tag_name: "v0.1.2-preview.1.security", name: "Security preview", body: "<b>Safe</b>", html_url: "https://example.test/newer", prerelease: true, draft: false, assets: [{ name: "RELEASES" }, { name: "Skladno-full.nupkg" }] },
        ])),
        notify: () => undefined, requestCheckpoint: async () => true, closeApplication: () => undefined, openExternal: async () => undefined,
    });
    try {
        const state = await coordinator.checkNow();
        assert.deepEqual(state.kind, "available");
        assert.equal(state.kind === "available" && state.version, "0.1.2-preview.1.security");
        assert.equal(checked, false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("update discovery requires persisted network access", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-updates-test-"));
    let requests = 0;
    const coordinator = createDesktopUpdateCoordinator({
        runtimePath: join(root, "runtime-settings.json"), currentVersion: "0.1.0-preview.1", database: { exec: () => undefined }, dataDirectory: root,
        updater: { setFeedURL: () => undefined, checkForUpdates: () => undefined, quitAndInstall: () => undefined, on: () => undefined },
        fetchReleases: async () => {
            requests += 1;
            return new Response(JSON.stringify([{ tag_name: "v0.1.1-preview.1", html_url: "https://example.test/release", prerelease: true, draft: false, assets: [{ name: "RELEASES" }, { name: "Skladno-full.nupkg" }] }]));
        },
        notify: () => undefined, requestCheckpoint: async () => true, closeApplication: () => undefined, openExternal: async () => undefined,
    });
    try {
        assert.equal((await coordinator.checkNow()).kind, "current");
        assert.equal(requests, 0);
        coordinator.setNetworkAccess(true);
        assert.equal((await coordinator.checkNow()).kind, "available");
        assert.equal(requests, 1);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
