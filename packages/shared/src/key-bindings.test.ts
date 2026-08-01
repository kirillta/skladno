import assert from "node:assert/strict";
import test from "node:test";

import { KEY_BINDING_COMMAND, findKeyBindingConflict, formatKeyBinding, normalizeKeyBinding, resolveKeyBindings } from "./key-bindings.js";

test("key bindings normalize, format, resolve defaults, and retain explicit unassignment", () => {
    const normalized = normalizeKeyBinding({ primary: true, shift: false, alt: true, key: " S " });
    assert.deepEqual(normalized, { primary: true, shift: false, alt: true, key: "s" });
    assert.equal(formatKeyBinding(normalized!, "MacIntel"), "Command+Option+S");
    assert.equal(formatKeyBinding(normalized!, "Win32"), "Ctrl+Alt+S");

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
