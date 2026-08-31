import assert from "node:assert/strict";
import test from "node:test";

import { desktopShellCommands, isDesktopShellCommand } from "../application/desktop-shell.js";
import { KEY_BINDING_COMMAND, findKeyBindingConflict, formatKeyBinding, normalizeKeyBinding, resolveKeyBindings } from "./key-bindings.js";

// Product scenarios: cross-cutting.key-binding-conflicts, settings.key-binding-overrides
test("key bindings normalize, format, resolve defaults, and retain explicit unassignment", () => {
    const normalized = normalizeKeyBinding({ primary: true, shift: false, alt: true, key: " S " });
    assert.deepEqual(normalized, { primary: true, shift: false, alt: true, key: "s" });
    assert.equal(formatKeyBinding(normalized!, "MacIntel"), "Command+Option+S");
    assert.equal(formatKeyBinding(normalized!, "Win32"), "Ctrl+Alt+S");
    assert.equal(formatKeyBinding({ primary: true, shift: true, alt: false, key: "+" }, "Win32"), "Ctrl++");

    const resolved = resolveKeyBindings({ [KEY_BINDING_COMMAND.SAVE_REVISION]: null });
    assert.equal(resolved[KEY_BINDING_COMMAND.SAVE_REVISION], null);
    assert.deepEqual(resolved[KEY_BINDING_COMMAND.NEW_ARTICLE], { primary: true, shift: false, alt: false, key: "n" });
});

test("key bindings report duplicate effective chords", () => {
    const conflict = findKeyBindingConflict(resolveKeyBindings({
        [KEY_BINDING_COMMAND.NEW_ARTICLE]: { primary: true, shift: false, alt: false, key: "s" },
    }));

    assert.deepEqual(conflict, [KEY_BINDING_COMMAND.NEW_ARTICLE, KEY_BINDING_COMMAND.SAVE_REVISION]);
});

test("desktop menu roles have a bounded native command allowlist", () => {
    assert.equal(desktopShellCommands.includes(KEY_BINDING_COMMAND.QUIT), true);
    assert.equal(desktopShellCommands.includes(KEY_BINDING_COMMAND.COPY), true);
    assert.equal(desktopShellCommands.includes(KEY_BINDING_COMMAND.TOGGLE_FULLSCREEN), true);
    assert.equal(isDesktopShellCommand("quit"), true);
    assert.equal(isDesktopShellCommand("arbitrary_native_action"), false);
});
