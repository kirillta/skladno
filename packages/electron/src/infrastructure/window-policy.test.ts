import assert from "node:assert/strict";
import test from "node:test";
import { createWindowOptions, focusWindow, isExternalWebUrl } from "./window-policy.js";


// product: application.electron-secured-window
test("desktop window keeps the renderer isolated and only accepts web links", () => {
    const options = createWindowOptions("C:\\preload.cjs", { x: 1, y: 2, width: 1200, height: 800 });

    assert.deepEqual(options.webPreferences, {
        preload: "C:\\preload.cjs",
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
    });
    assert.equal(isExternalWebUrl("https://example.com/article"), true);
    assert.equal(isExternalWebUrl("http://example.com/article"), true);
    assert.equal(isExternalWebUrl("file:///C:/private.txt"), false);
    assert.equal(isExternalWebUrl("javascript:alert(1)"), false);
});


test("a second desktop launch restores and focuses the existing window", () => {
    const calls: string[] = [];
    focusWindow({
        isMinimized: () => true,
        restore: () => calls.push("restore"),
        show: () => calls.push("show"),
        focus: () => calls.push("focus"),
    });

    assert.deepEqual(calls, ["restore", "show", "focus"]);
});
