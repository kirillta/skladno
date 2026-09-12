import { ELECTRON_IPC_CHANNEL } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import type { EditorialService } from "../../application/services/editorial/editorial-service.js";
import { invokeElectronApplication } from "./electron-ipc-invoke-adapter.js";
import { registerElectronStreamAdapters } from "./electron-ipc-stream-adapter.js";
import type { ElectronIpcMain } from "./electron-ipc-types.js";

export type { ElectronIpcMain, ElectronIpcMainEvent } from "./electron-ipc-types.js";


export function registerElectronIpcApplicationAdapter(ipcMain: ElectronIpcMain, services: ApplicationServices, editorial: EditorialService, now = () => new Date().toISOString()): () => void {
    const controllers = new Map<string, AbortController>();
    ipcMain.handle(ELECTRON_IPC_CHANNEL.invoke, (_event, request) => invokeElectronApplication(request, services, now));
    registerElectronStreamAdapters(ipcMain, services, editorial, controllers);
    return () => {
        for (const controller of controllers.values())
            controller.abort();

        controllers.clear();
    };
}
