import { describe, expect, it } from "vitest";
import { isReservedDesktopShortcut } from "./KeyBindingProvider.js";


function keydown(key: string, options: Partial<Parameters<typeof isReservedDesktopShortcut>[0]> = {}) {
    return { key, ctrlKey: false, metaKey: false, altKey: false, ...options };
}


describe("isReservedDesktopShortcut", () => {
    it("blocks cleared desktop defaults while permitting custom shortcuts to dispatch first", () => {
        expect(isReservedDesktopShortcut(keydown("w", { ctrlKey: true }))).toBe(true);
        expect(isReservedDesktopShortcut(keydown("F11"))).toBe(true);
        expect(isReservedDesktopShortcut(keydown("k", { ctrlKey: true }))).toBe(false);
        expect(isReservedDesktopShortcut(keydown("w", { ctrlKey: true, altKey: true }))).toBe(false);
    });
});
