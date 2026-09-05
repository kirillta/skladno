import { useEffect, useMemo } from "react";
import type { KeyBindingOverrides } from "@skladno/shared";
import { KeyBindingDispatcher } from "./dispatcher.js";


const reservedDesktopKeys = new Set(["a", "c", "m", "q", "u", "v", "w", "x", "y", "z", "+", "=", "-", "0"]);
const clipboardKeys = new Set(["c", "v", "x"]);


export function isReservedDesktopShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
    const key = event.key.toLowerCase();
    if (key === "f11")
        return !event.ctrlKey && !event.metaKey && !event.altKey;

    return !event.altKey && (event.ctrlKey || event.metaKey) && reservedDesktopKeys.has(key);
}


function isClipboardShortcut(event: KeyboardEvent): boolean {
    return !event.altKey && (event.ctrlKey || event.metaKey) && clipboardKeys.has(event.key.toLowerCase());
}


export function useKeyBindingDispatcher(overrides: KeyBindingOverrides | undefined, reserveDesktopShortcuts = false): KeyBindingDispatcher {
    const dispatcher = useMemo(() => new KeyBindingDispatcher(), []);

    useEffect(() => {
        dispatcher.setOverrides(overrides ?? {});
    }, [dispatcher, overrides]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented && !isClipboardShortcut(event))
                return;

            const target = event.target;
            const scope = target instanceof HTMLElement && target.closest('[data-workspace-panel="editorial-assistant"]') ? "assistant" : "application";
            if (!dispatcher.dispatch(event, scope) && reserveDesktopShortcuts && isReservedDesktopShortcut(event))
                event.preventDefault();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatcher, reserveDesktopShortcuts]);

    return dispatcher;
}
