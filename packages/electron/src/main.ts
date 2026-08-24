import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, screen, shell } from "electron";
import { createLocalApplication, loadServerEnvironment, registerElectronIpcApplicationAdapter } from "@skladno/server/electron";
import { defaultInterfaceLocale, electronMessagesFor } from "@skladno/shared";
import { requestDraftCheckpoint } from "./close-coordinator.js";
import { createWindowOptions, focusWindow, isExternalWebUrl } from "./window-policy.js";
import { readWindowBounds, writeWindowBounds } from "./window-state.js";
import { registerDesktopSettingsAdapter } from "./desktop-settings.js";


const rendererUrl = "http://localhost:5173";
let mainWindow: BrowserWindow | undefined;
let closeApplication: (() => void) | undefined;
let closing = false;
let nativeMessages = electronMessagesFor(defaultInterfaceLocale);


async function loadRenderer(window: BrowserWindow): Promise<void> {
    if (app.isPackaged) {
        await window.loadFile(join(process.resourcesPath, "dist", "index.html"));

        return;
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            const response = await fetch(rendererUrl);
            if (response.ok) {
                await window.loadURL(rendererUrl);

                return;
            }
        } catch {
            // Vite may still be starting.
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Could not load the Skladno renderer at ${rendererUrl}.`);
}


function focusMainWindow(): void {
    focusWindow(mainWindow);
}


async function quitFrom(window: BrowserWindow): Promise<void> {
    if (closing)
        return;

    closing = true;
    const checkpointed = await requestDraftCheckpoint(ipcMain, window.webContents);
    if (!checkpointed) {
        const { response } = await dialog.showMessageBox(window, {
            type: "warning",
            title: nativeMessages["electron.draftCheckpointFailed.title"],
            message: nativeMessages["electron.draftCheckpointFailed.message"],
            detail: nativeMessages["electron.draftCheckpointFailed.detail"],
            buttons: [nativeMessages["electron.draftCheckpointFailed.return"], nativeMessages["electron.draftCheckpointFailed.quit"]],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
        });
        if (response === 0) {
            closing = false;

            return;
        }
    }

    try {
        closeApplication?.();
    } catch {
        dialog.showErrorBox(nativeMessages["electron.closeFailed.title"], nativeMessages["electron.closeFailed.message"]);
    } finally {
        closeApplication = undefined;
        closing = false;
        window.destroy();
        app.quit();
    }
}


async function createMainWindow(): Promise<void> {
    const statePath = join(app.getPath("userData"), "window-state.json");
    const displays = screen.getAllDisplays().map(({ workArea }) => workArea);
    const preload = join(import.meta.dirname, "preload.cjs");
    const window = new BrowserWindow(createWindowOptions(preload, readWindowBounds(statePath, displays)));
    mainWindow = window;

    window.webContents.setWindowOpenHandler(({ url }) => {
        if (isExternalWebUrl(url))
            void shell.openExternal(url);

        return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        if (isExternalWebUrl(url))
            void shell.openExternal(url);
    });
    window.on("close", (event) => {
        event.preventDefault();
        void quitFrom(window);
    });
    window.on("closed", () => {
        if (mainWindow === window)
            mainWindow = undefined;
    });
    window.on("resized", () => {
        if (!window.isMaximized() && !window.isMinimized())
            writeWindowBounds(statePath, window.getBounds());
    });
    window.on("moved", () => {
        if (!window.isMaximized() && !window.isMinimized())
            writeWindowBounds(statePath, window.getBounds());
    });

    window.once("ready-to-show", () => window.show());
    await loadRenderer(window);
}


if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", focusMainWindow);
    app.whenReady().then(async () => {
        app.setAppUserModelId("io.github.kirillta.skladno");
        loadServerEnvironment();
        const application = createLocalApplication();
        nativeMessages = electronMessagesFor((await application.services.settings.getSnapshot()).general.interfaceLocale);
        const cancelStreams = registerElectronIpcApplicationAdapter(ipcMain, application.services, application.editorial);
        registerDesktopSettingsAdapter({
            ipcMain,
            shell,
            userDataPath: app.getPath("userData"),
            dataDirectory: process.env.SKLADNO_DATA_DIR || join(app.getPath("home"), ".skladno"),
            database: application.database,
            services: application.services,
            chooseDirectory: async () => (await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })).filePaths[0],
        });
        closeApplication = () => {
            cancelStreams();
            application.database.close();
        };

        await createMainWindow();
    }).catch(() => {
        dialog.showErrorBox(nativeMessages["electron.startFailed.title"], nativeMessages["electron.startFailed.message"]);
        closeApplication?.();
        app.quit();
    });
}
