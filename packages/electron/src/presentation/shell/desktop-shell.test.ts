import assert from "node:assert/strict";
import test from "node:test";
import { executeDesktopShellCommand } from "./desktop-shell.js";


test("desktop shell commands use only their corresponding native action", () => {
    const calls: string[] = [];
    let zoom = 0;
    let fullscreen = false;
    let maximized = false;
    const window = {
        webContents: {
            undo: () => calls.push("undo"), redo: () => calls.push("redo"), cut: () => calls.push("cut"), copy: () => calls.push("copy"), paste: () => calls.push("paste"), selectAll: () => calls.push("select-all"),
            getZoomLevel: () => zoom,
            setZoomLevel: (level: number) => {
                zoom = level;
                calls.push(`zoom:${level}`);
            },
        },
        minimize: () => calls.push("minimize"),
        isMaximized: () => maximized,
        maximize: () => {
            maximized = true;
            calls.push("maximize");
        },
        unmaximize: () => {
            maximized = false;
            calls.push("unmaximize");
        },
        isFullScreen: () => fullscreen,
        setFullScreen: (value: boolean) => {
            fullscreen = value;
            calls.push(`fullscreen:${value}`);
        },
    };
    const actions = { checkForUpdates: () => calls.push("updates"), quit: () => calls.push("quit") };

    for (const command of ["close_window", "quit", "check_for_updates", "undo", "redo", "cut", "copy", "paste", "select_all", "zoom_in", "zoom_out", "reset_zoom", "toggle_fullscreen", "minimize_window", "toggle_maximize", "toggle_maximize"] as const)
        executeDesktopShellCommand(window, command, actions);

    assert.deepEqual(calls, ["quit", "quit", "updates", "undo", "redo", "cut", "copy", "paste", "select-all", "zoom:0.5", "zoom:0", "zoom:0", "fullscreen:true", "minimize", "maximize", "unmaximize"]);
});
