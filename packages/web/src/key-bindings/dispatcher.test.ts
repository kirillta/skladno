import { KEY_BINDING_COMMAND } from "@skladno/shared";
import { describe, expect, it, vi } from "vitest";
import { KeyBindingDispatcher } from "./dispatcher.js";

function event(key: string, options: Partial<Parameters<KeyBindingDispatcher["dispatch"]>[0]> = {}) {
    return { key, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, repeat: false, isComposing: false, target: null, preventDefault: vi.fn(), ...options };
}

describe("KeyBindingDispatcher", () => {
    it("dispatches a registered command and prevents its browser default", () => {
        const dispatcher = new KeyBindingDispatcher();
        const handler = vi.fn();
        dispatcher.register(KEY_BINDING_COMMAND.SAVE_REVISION, handler);
        const keydown = event("s");

        expect(dispatcher.dispatch(keydown)).toBe(true);
        expect(handler).toHaveBeenCalledOnce();
        expect(keydown.preventDefault).toHaveBeenCalledOnce();
    });

    it("does not dispatch unmatched, composing, or repeated events", () => {
        const dispatcher = new KeyBindingDispatcher();
        const handler = vi.fn();
        dispatcher.register(KEY_BINDING_COMMAND.SAVE_REVISION, handler);

        expect(dispatcher.dispatch(event("x"))).toBe(false);
        expect(dispatcher.dispatch(event("s", { isComposing: true }))).toBe(false);
        expect(dispatcher.dispatch(event("s", { repeat: true }))).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it("updates overrides and unregisters handlers", () => {
        const dispatcher = new KeyBindingDispatcher();
        const handler = vi.fn();
        const unregister = dispatcher.register(KEY_BINDING_COMMAND.SAVE_REVISION, handler);
        dispatcher.setOverrides({ [KEY_BINDING_COMMAND.SAVE_REVISION]: { primary: true, shift: false, alt: false, key: "k" } });

        expect(dispatcher.dispatch(event("s"))).toBe(false);
        expect(dispatcher.dispatch(event("k"))).toBe(true);
        unregister();
        expect(dispatcher.dispatch(event("k"))).toBe(false);
    });
});
