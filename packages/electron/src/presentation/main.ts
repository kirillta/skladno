import { dirname, join } from "node:path";
import { app, autoUpdater, BrowserWindow, dialog, ipcMain, Menu, net, screen, shell } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { createLocalApplication, loadServerConfig, loadServerEnvironment, registerElectronIpcApplicationAdapter, validateDatabaseSnapshot } from "@skladno/server/electron";
import { defaultInterfaceLocale, getElectronMessagesFor } from "@skladno/shared";
import { requestDraftCheckpoint } from "../application/lifecycle/close-coordinator.js";
import { applyPendingRestore } from "../infrastructure/recovery/pending-restore.js";
import { PendingRestoreError } from "../infrastructure/recovery/pending-restore-error.js";
import { createWindowOptions, focusWindow, isExternalWebUrl } from "../infrastructure/window/window-policy.js";
import { readWindowBounds, writeWindowBounds } from "../infrastructure/window/window-state.js";
import { createTelemetryOwner } from "../infrastructure/telemetry/telemetry-owner.js";
import { createTelemetryDelivery, readTelemetryDelivery } from "../infrastructure/telemetry/telemetry-delivery.js";
import { createApplicationFailureEvent } from "./telemetry/application-failure-telemetry.js";
import { registerDesktopSettingsAdapter } from "./settings/desktop-settings.js";
import { registerDesktopTelemetryAdapter } from "./telemetry/desktop-telemetry.js";
import { registerDesktopShellAdapter } from "./shell/desktop-shell.js";
import { createDesktopUpdateCoordinator, desktopUpdatesEvent, registerDesktopUpdatesAdapter, supportsNativeUpdates } from "./updates/desktop-updates.js";


const rendererUrl = "http://localhost:5173";
let mainWindow: BrowserWindow | undefined;
let closeApplication: (() => void) | undefined;
let closing = false;
let nativeMessages = getElectronMessagesFor(defaultInterfaceLocale);
let updates: ReturnType<typeof createDesktopUpdateCoordinator> | undefined;
let telemetry: ReturnType<typeof createTelemetryOwner> | undefined;


async function loadRenderer(window: BrowserWindow): Promise<void> {
    if (app.isPackaged) {
        await window.loadFile(join(process.resourcesPath, "dist", "index.html"));

        return;
    }

    const maxFetchAttempts = 40;
    for (let attempt = 0; attempt < maxFetchAttempts; attempt += 1) {
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
    const window = new BrowserWindow(createWindowOptions(preload, readWindowBounds(statePath, displays), app.isPackaged));
    mainWindow = window;
    registerDesktopShellAdapter({
        ipcMain,
        window,
        checkForUpdates: () => void updates?.checkNow(),
        quit: () => void quitFrom(window),
    });

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
    window.webContents.on("render-process-gone", (_event, details) => {
        const failure = createApplicationFailureEvent("renderer", details.reason);
        if (failure)
            telemetry?.capture(failure);
    });
    window.on("close", (event) => {
        if (closing)
            return;

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

    window.once("ready-to-show", () => {
        window.show();
        telemetry?.capture({ kind: "app_session_started" });
    });
    await loadRenderer(window);
}


if (supportsNativeUpdates() && squirrelStartup) {
    app.quit();
} else if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", focusMainWindow);
    app.whenReady().then(async () => {
        if (supportsNativeUpdates())
            app.setAppUserModelId("io.github.kirillta.skladno");

        loadServerEnvironment();
        const config = loadServerConfig();
        const runtimePath = join(app.getPath("userData"), "runtime-settings.json");
        const telemetryDelivery = createTelemetryDelivery({
            packaged: app.isPackaged,
            appVersion: app.getVersion(),
            delivery: app.isPackaged ? readTelemetryDelivery(join(process.resourcesPath, "telemetry.json")) : undefined,
        });
        telemetry = createTelemetryOwner({ runtimePath, delivery: telemetryDelivery });
        const pendingRestore = applyPendingRestore({ runtimePath, databasePath: config.databasePath, telemetry });
        let application;
        try {
            application = createLocalApplication(config, telemetry);
            if (pendingRestore) {
                validateDatabaseSnapshot(config.databasePath);
                pendingRestore.complete();
            }
        } catch (error) {
            pendingRestore?.rollback();
            throw error;
        }

        nativeMessages = getElectronMessagesFor((await application.services.settings.getSnapshot()).general.interfaceLocale);
        const cancelStreams = registerElectronIpcApplicationAdapter(ipcMain, application.services, application.editorial);
        registerDesktopSettingsAdapter({
            ipcMain,
            shell,
            dialog,
            userDataPath: app.getPath("userData"),
            dataDirectory: dirname(config.databasePath),
            database: application.database,
            telemetry,
            services: application.services,
            messages: nativeMessages,
            chooseDirectory: async () => (await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })).filePaths[0],
            chooseBackupSnapshot: async (directory) => (await dialog.showOpenDialog({
                defaultPath: directory,
                filters: [{ name: "Skladno backups", extensions: ["sqlite"] }], properties: ["openFile"]
            })).filePaths[0],
            requestCheckpoint: () => mainWindow ? requestDraftCheckpoint(ipcMain, mainWindow.webContents) : Promise.resolve(false),
            closeApplication: () => {
                cancelStreams();
                telemetry?.dispose();
                application.database.close();
                closeApplication = undefined;
            },
            restart: () => {
                app.relaunch();
                app.exit(0);
            },
        });
        registerDesktopTelemetryAdapter({
            ipcMain,
            isAuthorizedSender: (event) => event.sender === mainWindow?.webContents,
            telemetry,
        });
        closeApplication = () => {
            cancelStreams();
            telemetry?.dispose();
            application.database.close();
            closing = true;
        };

        if (supportsNativeUpdates())
            updates = createDesktopUpdateCoordinator(
                { runtimePath, currentVersion: app.getVersion(), supported: app.isPackaged },
                {
                    fetchReleases: () => net.fetch("https://api.github.com/repos/kirillta/skladno/releases"),
                    openExternal: (url) => shell.openExternal(url),
                },
                {
                    database: application.database,
                    dataDirectory: dirname(config.databasePath),
                    updater: autoUpdater,
                    requestCheckpoint: () => mainWindow ? requestDraftCheckpoint(ipcMain, mainWindow.webContents) : Promise.resolve(false),
                    closeApplication: () => closeApplication?.(),
                    telemetry,
                },
                { notify: (state) => mainWindow?.webContents.send(desktopUpdatesEvent, state) },
            );

        app.on("child-process-gone", (_event, details) => {
            const failure = createApplicationFailureEvent("child_process", details.reason);
            if (failure)
                telemetry?.capture(failure);
        });
        if (updates)
            registerDesktopUpdatesAdapter({ ipcMain, coordinator: updates });

        Menu.setApplicationMenu(null);

        await createMainWindow();
        updates?.schedule();
    }).catch((error: unknown) => {
        telemetry?.capture({ kind: "app_failure", source: "startup", failure: error instanceof PendingRestoreError ? "persistence" : "unknown" });
        if (!app.isPackaged)
            console.error("Skladno startup failed.", error);

        const message = error instanceof PendingRestoreError
            ? nativeMessages["electron.restoreFailed.message"]
            : nativeMessages["electron.startFailed.message"];
        const title = error instanceof PendingRestoreError
            ? nativeMessages["electron.restoreFailed.title"]
            : nativeMessages["electron.startFailed.title"];
        dialog.showErrorBox(title, message);
        closeApplication?.();
        app.quit();
    });
}
