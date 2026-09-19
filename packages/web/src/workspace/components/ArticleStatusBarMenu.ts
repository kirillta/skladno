import type { KeyboardEvent } from "react";


export function openStatusMenu(event: KeyboardEvent<HTMLButtonElement>, open: () => void, menuId: string) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
        return;

    event.preventDefault();
    open();
    requestAnimationFrame(() => {
        const items = document.getElementById(menuId)?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]");
        items?.[event.key === "ArrowDown" ? 0 : items.length - 1]?.focus();
    });
}


export function handleStatusMenuKeyDown(event: KeyboardEvent<HTMLDivElement>, close: () => void) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role^=menuitem]")];
    const index = document.activeElement instanceof HTMLButtonElement ? items.indexOf(document.activeElement) : -1;
    const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : undefined;

    if (event.key === "Escape") {
        event.preventDefault();
        close();
    } else if (next !== undefined) {
        event.preventDefault();
        items[(next + items.length) % items.length]?.focus();
    }
}
