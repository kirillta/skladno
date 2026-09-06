import type { ElectronInvokeResult, ElectronStreamEvent } from "@skladno/shared";


export interface ElectronIpcMainEvent {
    sender: {
        send(channel: string, payload: ElectronStreamEvent): void;
    };
}


export interface ElectronIpcMain {
    handle(channel: string, listener: (event: ElectronIpcMainEvent, request: unknown) => Promise<ElectronInvokeResult> | ElectronInvokeResult): void;
    on(channel: string, listener: (event: ElectronIpcMainEvent, payload: unknown) => void): void;
}
