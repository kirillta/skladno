import { randomUUID } from "node:crypto";
import { ELECTRON_LIFECYCLE_CHANNEL, type ElectronCheckpointResult } from "@skladno/shared";


interface CheckpointSender {
    send(channel: string, payload: { requestId: string }): void;
}


interface CheckpointEvent {
    sender: CheckpointSender;
}


interface CheckpointIpc {
    on(channel: string, listener: (event: CheckpointEvent, payload: unknown) => void): void;
    removeListener(channel: string, listener: (event: CheckpointEvent, payload: unknown) => void): void;
}


function isCheckpointResult(value: unknown, requestId: string): value is ElectronCheckpointResult {
    return value !== null
        && typeof value === "object"
        && "requestId" in value
        && value.requestId === requestId
        && "ok" in value
        && typeof value.ok === "boolean";
}


export function requestDraftCheckpoint(ipc: CheckpointIpc, sender: CheckpointSender, timeoutMs = 10_000): Promise<boolean> {
    const requestId = randomUUID();

    return new Promise((resolve) => {
        const finish = (ok: boolean) => {
            clearTimeout(timeout);
            ipc.removeListener(ELECTRON_LIFECYCLE_CHANNEL.checkpointResult, receive);
            resolve(ok);
        };
        const receive = (event: CheckpointEvent, payload: unknown) => {
            if (event.sender === sender && isCheckpointResult(payload, requestId))
                finish(payload.ok);
        };
        const timeout = setTimeout(() => finish(false), timeoutMs);

        ipc.on(ELECTRON_LIFECYCLE_CHANNEL.checkpointResult, receive);
        sender.send(ELECTRON_LIFECYCLE_CHANNEL.prepareClose, { requestId });
    });
}
