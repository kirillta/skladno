import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { APPLICATION_ERROR, HTTP_STATUS, ELECTRON_APPLICATION_METHOD, ELECTRON_IPC_CHANNEL, type ElectronStreamRequest, type ElectronStreamEvent, type ElectronApplicationMethod, type ElectronApplicationOperationMap, type ElectronIpcError, type ElectronInvokeResult } from "@skladno/shared";

import { createApplicationServices } from "../../application/create-application-services.js";
import { EditorialService } from "../../application/editorial/editorial-service.js";
import type { EditorialEngine } from "../../application/editorial/engine/editorial-engine.js";
import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
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


    stream(request: ElectronStreamRequest): Promise<ElectronStreamEvent> {
        return new Promise((resolve) => {
            this.listeners.get(ELECTRON_IPC_CHANNEL.stream)!({ sender: { send: (_channel, event) => {
                if (event.event.type === "error" || event.event.type === "completed")
                    resolve(event);
            } } }, request);
        });
    }
}


function createAdapter(engine?: EditorialEngine): { ipcMain: FakeIpcMain; close: () => void } {
    const directory = mkdtempSync(join(tmpdir(), "skladno-electron-ipc-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const persistence = createTestPersistence(database);
    const engines = { resolve: () => engine };
    const services = createApplicationServices({
        stores: { articles: persistence.articles, styleCorpus: persistence.styleCorpus, assistant: persistence.assistant, artifacts: persistence.editorialArtifacts, engines, factChecks: persistence.factChecks },
        settings: { settings: persistence.settings, dateTimeFormat: { read: async () => ({ locale: "en" }) }, models: { list: async () => [] }, createConnectionId: () => "connection" },
    });
    const editorial = new EditorialService(
        { articles: persistence.articles, sessions: persistence.editorialSessions, styleCorpus: persistence.styleCorpus, artifacts: persistence.editorialArtifacts, factChecks: persistence.factChecks },
        { engines, sessionContinuationEnabled: false },
    );
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

        const rejectedTranslation = await adapter.ipcMain.invoke({ method: ELECTRON_APPLICATION_METHOD.rejectTranslation, args: ["article", "artifact"] });
        assert.deepEqual(rejectedTranslation, { ok: true, value: undefined });

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


test("Electron IPC delivers the timeout code as a terminal Assistant event", async () => {
    const adapter = createAdapter({
        async *stream() {
            yield* [];
        },
        async *streamConversation() {
            yield* [];
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT, HTTP_STATUS.BAD_REQUEST);
        },
    });
    try {
        const created = await adapter.ipcMain.invoke({ method: "createArticle", args: [{ title: "Timeout", content: "Hello" }] });
        assert.ok(created.ok);
        const event = await adapter.ipcMain.stream({ kind: "assistant", streamId: "timeout-stream", articleId: created.value.id, input: { kind: "new", requestId: "timeout-request", authorMessage: "Hello", scope: { kind: "article", baseRevisionId: created.value.currentRevisionId } } });
        assert.equal(event.event.type, "error");
        if (event.event.type === "error")
            assert.equal(event.event.errorCode, APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT);
    } finally {
        adapter.close();
    }
});


test("Electron IPC rejects invalid publishing settings before persistence", async () => {
    const adapter = createAdapter();
    try {
        const invalid = await adapter.ipcMain.invoke({ method: ELECTRON_APPLICATION_METHOD.setPublishingSettings, args: [{ defaultProfileId: "custom-00000000-0000-0000-0000-000000000001", customProfiles: [] } as never] });
        assert.equal(invalid.ok, false);
        if (invalid.ok)
            return;

        assert.equal(invalid.error.code, "unsupported_publishing_profile");
        assert.equal(invalid.error.status, 400);

        const settings = await adapter.ipcMain.invoke({ method: ELECTRON_APPLICATION_METHOD.getPublishingSettings, args: [] });
        assert.deepEqual(settings, { ok: true, value: { defaultProfileId: "default", customProfiles: [] } });
    } finally {
        adapter.close();
    }
});
