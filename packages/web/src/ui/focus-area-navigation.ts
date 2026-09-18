import { useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";


export const workspaceFocusAreas = ["library", "article-header", "workspace-views", "formatting-toolbar", "article-editor", "article-status", "assistant-chat", "assistant-composer"] as const;
export const settingsFocusAreas = ["settings-navigation", "settings-content"] as const;


function isAvailable(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return !element.closest("[hidden], [aria-hidden=true]") && !element.matches(":disabled") && style.display !== "none" && style.visibility !== "hidden";
}


function entryFor(area: HTMLElement, lastFocused: HTMLElement | undefined): HTMLElement | undefined {
    if (lastFocused && area.contains(lastFocused) && isAvailable(lastFocused))
        return lastFocused;

    if (area.matches("[data-focus-area-entry]"))
        return area;

    return area.querySelector<HTMLElement>("[data-focus-area-entry], a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable=true], [tabindex]:not([tabindex='-1'])") ?? undefined;
}


export function useFocusAreaNavigation(order: readonly string[]): { ref: RefObject<HTMLElement>; onFocusCapture: (event: FocusEvent<HTMLElement>) => void; onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => void } {
    const ref = useRef<HTMLElement>(null);
    const lastFocused = useRef(new Map<string, HTMLElement>());


    function onFocusCapture(event: FocusEvent<HTMLElement>) {
        const target = event.target instanceof HTMLElement ? event.target : undefined;
        const area = target?.closest<HTMLElement>("[data-focus-area]");
        const name = area?.dataset.focusArea;
        if (target && area && name && isAvailable(target))
            lastFocused.current.set(name, target);
    }


    function onKeyDownCapture(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
            return;

        const target = event.target instanceof HTMLElement ? event.target : undefined;
        if (!target || target.closest("dialog[open], [role=dialog], [role=menu], [role=listbox]"))
            return;

        const current = target.closest<HTMLElement>("[data-focus-area]");
        if (!current)
            return;

        const areas = order.flatMap((name) => {
            const area = [...(ref.current?.querySelectorAll<HTMLElement>(`[data-focus-area='${name}']`) ?? [])].find((candidate) => isAvailable(candidate) && entryFor(candidate, lastFocused.current.get(name)));
            return area ? [area] : [];
        });
        const index = areas.indexOf(current);
        if (index < 0 || areas.length < 2)
            return;

        const next = areas[(index + (event.shiftKey ? areas.length - 1 : 1)) % areas.length];
        const entry = next && entryFor(next, lastFocused.current.get(next.dataset.focusArea ?? ""));
        if (!entry)
            return;

        event.preventDefault();
        entry.focus();
    }


    return { ref, onFocusCapture, onKeyDownCapture };
}
