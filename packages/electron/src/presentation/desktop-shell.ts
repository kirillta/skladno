import type { BrowserWindow, IpcMain, IpcRenderer } from "electron";
import { isDesktopShellCommand, type DesktopShellClient, type DesktopShellCommand } from "@skladno/shared";


export const desktopShellChannel = "skladno:desktop-shell";


type DesktopShellWindow = Pick<BrowserWindow, "minimize" | "isMaximized" | "maximize" | "unmaximize" | "isFullScreen" | "setFullScreen"> & {
    webContents: Pick<BrowserWindow["webContents"], "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll" | "getZoomLevel" | "setZoomLevel">;
};


export function executeDesktopShellCommand(window: DesktopShellWindow, command: DesktopShellCommand, { checkForUpdates, quit }: { checkForUpdates(): void; quit(): void }): void {
    switch (command) {
        case "close_window":
        case "quit":
            quit();
            return;
        case "check_for_updates":
            checkForUpdates();
            return;
        case "undo":
            window.webContents.undo();
            return;
        case "redo":
            window.webContents.redo();
            return;
        case "cut":
            window.webContents.cut();
            return;
        case "copy":
            window.webContents.copy();
            return;
        case "paste":
            window.webContents.paste();
            return;
        case "select_all":
            window.webContents.selectAll();
            return;
        case "zoom_in":
            window.webContents.setZoomLevel(window.webContents.getZoomLevel() + 0.5);
            return;
        case "zoom_out":
            window.webContents.setZoomLevel(window.webContents.getZoomLevel() - 0.5);
            return;
        case "reset_zoom":
            window.webContents.setZoomLevel(0);
            return;
        case "toggle_fullscreen":
            window.setFullScreen(!window.isFullScreen());
            return;
        case "minimize_window":
            window.minimize();
            return;
        case "toggle_maximize":
            if (window.isMaximized())
                window.unmaximize();
            else
                window.maximize();

            return;
    }
}


export function registerDesktopShellAdapter({ ipcMain, window, checkForUpdates, quit }: { ipcMain: IpcMain; window: BrowserWindow; checkForUpdates(): void; quit(): void }): void {
    ipcMain.on(desktopShellChannel, (event, command: unknown) => {
        if (event.sender !== window.webContents || !isDesktopShellCommand(command))
            return;

        executeDesktopShellCommand(window, command, { checkForUpdates, quit });
    });
}


export function createDesktopShellClient(ipcRenderer: Pick<IpcRenderer, "send">): DesktopShellClient {
    return {
        execute(command) {
            if (isDesktopShellCommand(command))
                ipcRenderer.send(desktopShellChannel, command);
        },
    };
}
