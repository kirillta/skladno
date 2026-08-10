import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ELECTRON_IPC_CHANNEL, type ElectronApplicationMethod, type ElectronApplicationOperationMap, type ElectronIpcError, type ElectronInvokeResult } from "@skladno/shared";

import { createApplicationServices } from "../../application/create-application-services.js";
import { EditorialService } from "../../application/editorial/editorial-service.js";
import { openDatabase } from "../persistence/index.js";
import { createTestPersistence } from "../../test-support/test-persistence.js";
import { registerElectronIpcApplicationAdapter, type ElectronIpcMain, type ElectronIpcMainEvent } from "./electron-ipc-application-adapter.js";


class FakeIpcMain implements ElectronIpcMain {
    private readonly handlers = new Map<string, (event: ElectronIpcMainEvent, request: unknown) => Promise<ElectronInvokeResult> | ElectronInvokeResult>();
    private readonly listeners = new Map<string, (event: ElectronIpcMainEvent, payload: unknown) => void>();

    handle(channel: string, listener: (event: ElectronIpcMainEvent, request: unknown) => Promise<ElectronInvokeResult> | ElectronInvokeResult): void {
        this.handlers.set(channel, listener);
    }


    on(channel: string, listener: (event: ElectronIpcMainEvent, payload: unknown) => void): void {
        this.listeners.set(channel, listener);
    }


    invoke<Method extends ElectronApplicationMethod>(request: { method: Method; args: ElectronApplicationOperationMap[Method]["args"] }): Promise<ElectronInvokeResult<Method>> | ElectronInvokeResult<Method> {
        return this.handlers.get(ELECTRON_IPC_CHANNEL.invoke)!({ sender: { send: () => undefined } }, request) as Promise<ElectronInvokeResult<Method>> | ElectronInvokeResult<Method>;
    }
}


function createAdapter(): { ipcMain: FakeIpcMain; close: () => void } {
    const directory = mkdtempSync(join(tmpdir(), "skladno-electron-ipc-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const persistence = createTestPersistence(database);
    const engines = { resolve: () => undefined };
    const services = createApplicationServices(persistence.articles, persistence.settings, persistence.styleCorpus, persistence.assistant, persistence.editorialArtifacts, engines, { read: async () => ({ locale: "en" }) }, { list: async () => [] }, () => "connection");
    const editorial = new EditorialService(persistence.articles, persistence.editorialSessions, persistence.styleCorpus, persistence.editorialArtifacts, engines, false);
    const ipcMain = new FakeIpcMain();

    registerElectronIpcApplicationAdapter(ipcMain, services, editorial, () => "2026-08-10T00:00:00.000Z");

    return {
        ipcMain,
        close: () => {
            database.close();
            rmSync(directory, { recursive: true, force: true });
        },
    };
}


test("Electron IPC invokes application services and serializes conflict details", async () => {
    const adapter = createAdapter();
    try {
        const health = await adapter.ipcMain.invoke({ method: "getHealth", args: [] });
        assert.deepEqual(health, { ok: true, value: { status: "ok", service: "skladno-local-service", timestamp: "2026-08-10T00:00:00.000Z" } });

        const created = await adapter.ipcMain.invoke({ method: "createArticle", args: [{ title: "Draft", content: "first" }] });
        assert.equal(created.ok, true);
        if (!created.ok)
            return;

        const article = created.value;
        const draft = await adapter.ipcMain.invoke({ method: "saveArticleDraft", args: [article.id, { content: "checkpoint", baseRevisionId: article.currentRevisionId }] });
        assert.equal(draft.ok, true);
        if (!draft.ok)
            return;

        const conflict = await adapter.ipcMain.invoke({ method: "saveArticleDraft", args: [article.id, { content: "stale", baseRevisionId: article.currentRevisionId, expectedDraftVersion: 0 }] });
        assert.equal(conflict.ok, false);
        if (conflict.ok)
            return;

        const error = conflict.error as ElectronIpcError;
        assert.equal(error.code, "draft_conflict");
        assert.equal(error.status, 409);
        assert.equal(error.article?.id, article.id);
        assert.equal(error.draft?.version, 1);
    } finally {
        adapter.close();
    }
});
