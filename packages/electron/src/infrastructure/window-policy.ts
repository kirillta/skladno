import type { BrowserWindowConstructorOptions } from "electron";


interface FocusableWindow {
    isMinimized(): boolean;
    restore(): void;
    show(): void;
    focus(): void;
}


export function createWindowOptions(preload: string, bounds: Electron.Rectangle, updatesEnabled = false): BrowserWindowConstructorOptions {
    return {
        ...bounds,
        minWidth: 900,
        minHeight: 640,
        show: false,
        backgroundColor: "#f7f6f2",
        webPreferences: {
            preload,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            ...(updatesEnabled ? { additionalArguments: ["--skladno-updates"] } : {}),
        },
    };
}


export function focusWindow(window: FocusableWindow | undefined): void {
    if (!window)
        return;

    if (window.isMinimized())
        window.restore();

    window.show();
    window.focus();
}


export function isExternalWebUrl(value: string): boolean {
    try {
        const protocol = new URL(value).protocol;

        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}
