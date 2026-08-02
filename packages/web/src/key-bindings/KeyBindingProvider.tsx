import { useEffect, useMemo } from "react";
import type { KeyBindingOverrides } from "@skladno/shared";
import { KeyBindingDispatcher } from "./dispatcher.js";

export function useKeyBindingDispatcher(overrides: KeyBindingOverrides | undefined): KeyBindingDispatcher {
    const dispatcher = useMemo(() => new KeyBindingDispatcher(), []);

    useEffect(() => {
        dispatcher.setOverrides(overrides ?? {});
    }, [dispatcher, overrides]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            const scope = target instanceof HTMLElement && target.closest('[data-workspace-panel="editorial-assistant"]') ? "assistant" : "application";
            dispatcher.dispatch(event, scope);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatcher]);

    return dispatcher;
}
