import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";

import { ApplicationSettingsService } from "../../application/settings/application-settings-service.js";
import type { LocalDiagnostics } from "../../infrastructure/diagnostics/local-diagnostics.js";
import { object, readBinary, readJson, writeJson } from "../transport/json.js";


export async function handleSettingsSnapshotRoute(response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, await settings.getSnapshot());
}


export async function handleGeneralSettingsRoute(request: IncomingMessage, response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, settings.updateGeneral(object(await readJson(request))));
}


export async function handleBackupPolicyRoute(request: IncomingMessage, response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, settings.updateBackupPolicy(object(await readJson(request))));
}


export function handleCreateBackupRoute(response: ServerResponse, settings: ApplicationSettingsService, diagnostics?: LocalDiagnostics): void {
    let backup: ReturnType<ApplicationSettingsService["createBackup"]> | undefined;
    try {
        backup = settings.createBackup();
        response.writeHead(HTTP_STATUS.CREATED, {
            "content-type": "application/vnd.sqlite3",
            "content-disposition": `attachment; filename="skladno-backup-${backup.createdAt.replaceAll(/[:.]/g, "-")}.sqlite"`,
        });
        response.end(readFileSync(backup.path));
    } catch (error) {
        diagnostics?.write("backup.failed", { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }, error);
        writeJson(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: { code: APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED } });
    } finally {
        backup?.cleanup();
    }
}


export async function handleRestoreBackupRoute(request: IncomingMessage, response: ServerResponse, restore: (snapshot: Uint8Array) => Promise<void>): Promise<void> {
    await restore(await readBinary(request));
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export async function handleKeyBindingsRoute(request: IncomingMessage, response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, settings.updateKeyBindingOverrides(object(await readJson(request))));
}


export async function handleModelPreferencesRoute(request: IncomingMessage, response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, settings.updateModelPreferences(object(await readJson(request))));
}


export async function handleCreateAiConnectionRoute(request: IncomingMessage, response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.CREATED, settings.createAiConnection(object(await readJson(request))));
}


export async function handleSetAiConnectionActiveRoute(request: IncomingMessage, response: ServerResponse, connectionId: string, settings: ApplicationSettingsService): Promise<void> {
    const value = object(await readJson(request));
    writeJson(response, HTTP_STATUS.OK, settings.setAiConnectionActive(connectionId, value.active === true));
}


export async function handleTestAiConnectionRoute(response: ServerResponse, connectionId: string, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, await settings.testAiConnection(connectionId));
}


export async function handleUpdateAiConnectionRoute(request: IncomingMessage, response: ServerResponse, connectionId: string, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, settings.updateAiConnection(connectionId, object(await readJson(request))));
}


export function handleDeleteAiConnectionRoute(response: ServerResponse, connectionId: string, settings: ApplicationSettingsService): void {
    settings.deleteAiConnection(connectionId);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export async function handleAiModelsRoute(response: ServerResponse, settings: ApplicationSettingsService): Promise<void> {
    writeJson(response, HTTP_STATUS.OK, await settings.listAiModels());
}
