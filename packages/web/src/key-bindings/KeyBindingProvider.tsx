import { useEffect, useMemo } from "react";
import type { KeyBindingOverrides } from "@skladno/shared";
import { KeyBindingDispatcher } from "./dispatcher.js";

export function useKeyBindingDispatcher(overrides: KeyBindingOverrides | undefined): KeyBindingDispatcher {
    const dispatcher = useMemo(() => new KeyBindingDispatcher(), []);

    useEffect(() => {
        dispatcher.setOverrides(overrides ?? {});
    }, [dispatcher, overrides]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => dispatcher.dispatch(event);
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatcher]);

    return dispatcher;
}
