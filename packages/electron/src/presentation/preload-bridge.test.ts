import assert from "node:assert/strict";
import test from "node:test";
import { ELECTRON_IPC_CHANNEL, type ElectronInvokeRequest, type ElectronStreamEvent } from "@skladno/shared";
import { createElectronApplicationClient, exposeElectronApplicationClient, type ElectronContextBridge, type ElectronIpcRenderer } from "./preload-bridge.js";


test("preload exposes only the typed application client and completes streams", async () => {
    let streamListener: ((event: unknown, payload: ElectronStreamEvent) => void) | undefined;
    const ipcRenderer: ElectronIpcRenderer = {
        invoke: (_channel: string, request: ElectronInvokeRequest) => {
            if (request.method === "getHealth")
                return Promise.resolve({ ok: true, value: { status: "ok", service: "skladno-local-service", timestamp: "2026-08-23T00:00:00.000Z" } });

            return Promise.resolve({ ok: true, value: [] });
        },
        send: (channel, payload) => {
            if (channel !== ELECTRON_IPC_CHANNEL.stream || !("kind" in payload) || payload.kind !== "assistant")
                return;

            queueMicrotask(() => streamListener?.({}, {
                streamId: payload.streamId,
                kind: "assistant",
                event: { type: "completed", requestId: payload.input.requestId, responseKind: "editorial_conversation", messageId: "message-1" },
            }));
        },
        on: (_channel, listener) => {
            streamListener = listener;
        },
        removeListener: () => {
            streamListener = undefined;
        },
    };
    let exposed: unknown;
    const contextBridge: ElectronContextBridge = {
        exposeInMainWorld: (name, api) => {
            assert.equal(name, "skladno");
            exposed = api;
        },
    };

    exposeElectronApplicationClient(ipcRenderer, contextBridge);
    assert.equal(exposed !== null && typeof exposed === "object" && "invoke" in exposed, false);

    const client = createElectronApplicationClient(ipcRenderer, () => "00000000-0000-4000-8000-000000000001");
    assert.equal((await client.getHealth()).status, "ok");
    assert.deepEqual(await client.listFactChecks?.("article-1"), []);
    await client.streamAssistantRequest("article-1", {
        kind: "new",
        requestId: "request-1",
        authorMessage: "Check this",
        scope: { kind: "article", baseRevisionId: "revision-1" },
    }, () => undefined);
    assert.equal(streamListener, undefined);
});
