import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";

import type { BackupBundleTransfers } from "../../infrastructure/persistence/backup-bundle.js";
import { ApplicationServiceError } from "../errors/application-error.js";
import { readBinary, readJson, writeJson } from "../transport/json.js";


function requestedIndex(value: string): number {
    const index = Number(value);
    if (!Number.isSafeInteger(index) || index < 0)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return index;
}


export function createBackupExportRoute(response: ServerResponse, transfers: BackupBundleTransfers): void {
    writeJson(response, HTTP_STATUS.CREATED, transfers.createExport());
}


export function readBackupExportRoute(response: ServerResponse, transfers: BackupBundleTransfers, id: string, index: string): void {
    const bytes = transfers.readExport(id, requestedIndex(index));
    response.writeHead(HTTP_STATUS.OK, { "content-type": "application/octet-stream" });
    response.end(bytes);
}


export function removeBackupTransferRoute(response: ServerResponse, transfers: BackupBundleTransfers, id: string): void {
    transfers.remove(id);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export async function beginBackupImportRoute(request: IncomingMessage, response: ServerResponse, transfers: BackupBundleTransfers): Promise<void> {
    writeJson(response, HTTP_STATUS.CREATED, { id: transfers.beginImport(await readJson(request, 5_000_000)) });
}


export async function writeBackupImportRoute(request: IncomingMessage, response: ServerResponse, transfers: BackupBundleTransfers, id: string, index: string): Promise<void> {
    transfers.writeImport(id, requestedIndex(index), await readBinary(request));
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}


export async function restoreBackupImportRoute(response: ServerResponse, transfers: BackupBundleTransfers, id: string): Promise<void> {
    await transfers.restoreImport(id);
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();
}
