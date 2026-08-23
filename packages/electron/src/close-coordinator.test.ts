import assert from "node:assert/strict";
import test from "node:test";
import { ELECTRON_LIFECYCLE_CHANNEL } from "@skladno/shared";
import { requestDraftCheckpoint } from "./close-coordinator.js";


// product: application.electron-draft-preserving-close
test("desktop close waits for the matching renderer checkpoint", async () => {
    const listeners = new Set<(event: { sender: typeof sender }, payload: unknown) => void>();
    const sender = {
        send(channel: string, payload: { requestId: string }) {
            assert.equal(channel, ELECTRON_LIFECYCLE_CHANNEL.prepareClose);
            queueMicrotask(() => listeners.forEach((listener) => listener({ sender }, { ...payload, ok: true })));
        },
    };
    const ipc = {
        on(_channel: string, listener: (event: { sender: typeof sender }, payload: unknown) => void) {
            listeners.add(listener);
        },
        removeListener(_channel: string, listener: (event: { sender: typeof sender }, payload: unknown) => void) {
            listeners.delete(listener);
        },
    };

    assert.equal(await requestDraftCheckpoint(ipc, sender, 100), true);
    assert.equal(listeners.size, 0);
});


test("desktop close reports a failed checkpoint when the renderer does not answer", async () => {
    const listeners = new Set<(event: { sender: typeof sender }, payload: unknown) => void>();
    const sender = { send: () => undefined };
    const ipc = {
        on(_channel: string, listener: (event: { sender: typeof sender }, payload: unknown) => void) {
            listeners.add(listener);
        },
        removeListener(_channel: string, listener: (event: { sender: typeof sender }, payload: unknown) => void) {
            listeners.delete(listener);
        },
    };

    assert.equal(await requestDraftCheckpoint(ipc, sender, 1), false);
    assert.equal(listeners.size, 0);
});
