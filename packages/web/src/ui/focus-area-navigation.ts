import { useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";


export const workspaceFocusAreas = ["library", "article-header", "workspace-views", "formatting-toolbar", "article-editor", "article-status", "assistant-chat", "assistant-composer"] as const;
export const settingsFocusAreas = ["settings-navigation", "settings-content"] as const;


function isAvailable(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return !element.closest("[hidden], [aria-hidden=true]") && !element.matches(":disabled") && style.display !== "none" && style.visibility !== "hidden";
}


const focusableSelector = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable=true], [tabindex]";


export function useFocusAreaNavigation(order: readonly string[]): { ref: RefObject<HTMLElement>; onFocusCapture: (event: FocusEvent<HTMLElement>) => void; onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => void } {
    const ref = useRef<HTMLElement>(null);
    const lastFocused = useRef(new Map<string, HTMLElement>());


    function controlsFor(name: string): HTMLElement[] {
        const areas = ref.current?.querySelectorAll<HTMLElement>(`[data-focus-area='${name}']`) ?? [];
        return [...areas].flatMap((area) => {
            const candidates = area.matches(focusableSelector) ? [area, ...area.querySelectorAll<HTMLElement>(focusableSelector)] : [...area.querySelectorAll<HTMLElement>(focusableSelector)];
            return candidates.filter((candidate) => (candidate.tabIndex >= 0 || candidate.isContentEditable || candidate.getAttribute("contenteditable") === "true") && isAvailable(candidate));
        });
    }


    function entryFor(name: string): HTMLElement | undefined {
        const controls = controlsFor(name);
        const entry = controls.find((control) => control.hasAttribute("data-focus-area-entry"));
        if (entry)
            return entry;

        const last = lastFocused.current.get(name);
        if (last && controls.includes(last))
            return last;

        return controls[0];
    }


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

        const name = current.dataset.focusArea;
        if (!name)
            return;

        const areas = order.filter((areaName) => controlsFor(areaName).length > 0);
        const index = areas.indexOf(name);
        if (index < 0 || areas.length < 2)
            return;

        const next = areas[(index + (event.shiftKey ? areas.length - 1 : 1)) % areas.length];
        const entry = next ? entryFor(next) : undefined;
        if (!entry)
            return;

        event.preventDefault();
        entry.focus();
    }


    return { ref, onFocusCapture, onKeyDownCapture };
}
