import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_METHOD, HTTP_STATUS } from "@skladno/shared";

import type { ApplicationServices } from "../application/application-services.js";
import { ArticleDraftConflictError } from "../application/articles/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../application/articles/article-revision-conflict-error.js";
import type { EditorialService } from "../application/editorial/editorial-service.js";
import type { ServerConfig } from "../infrastructure/configuration/config.js";
import type { LocalDiagnostics } from "../infrastructure/diagnostics/local-diagnostics.js";
import type { BackupBundleTransfers } from "../infrastructure/persistence/backup-bundle.js";
import { ApplicationServiceError } from "./errors/application-error.js";
import { createPresentationRouter } from "./routes/create-presentation-router.js";
import { writeJson } from "./transport/json.js";


function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
    return request.headers.origin === undefined || request.headers.origin === config.webOrigin;
}


function addCorsHeaders(request: IncomingMessage, response: ServerResponse, config: ServerConfig): void {
    if (request.headers.origin !== config.webOrigin)
        return;

    response.setHeader("access-control-allow-origin", config.webOrigin);
    response.setHeader("vary", "Origin");
}


function handleOptionsRequest(request: IncomingMessage, response: ServerResponse): boolean {
    if (request.method !== HTTP_METHOD.OPTIONS)
        return false;

    response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

    return true;
}


function getRequestErrorStatus(error: unknown): number {
    if (error instanceof ApplicationServiceError)
        return error.status;

    return error instanceof ArticleRevisionConflictError || error instanceof ArticleDraftConflictError
        ? HTTP_STATUS.CONFLICT
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
}


function writeRequestError(error: unknown, request: IncomingMessage, response: ServerResponse, diagnostics?: LocalDiagnostics): void {
    diagnostics?.write("request.failed", {
        method: request.method ?? "unknown",
        status: getRequestErrorStatus(error),
    }, error);

    if (error instanceof ArticleRevisionConflictError) {
        writeJson(response, HTTP_STATUS.CONFLICT, { error: { code: APPLICATION_ERROR.REVISION_CONFLICT }, article: error.article });
        return;
    }

    if (error instanceof ArticleDraftConflictError) {
        writeJson(response, HTTP_STATUS.CONFLICT, {
            error: { code: APPLICATION_ERROR.DRAFT_CONFLICT },
            article: error.article,
            ...(error.draft ? { draft: error.draft } : {}),
        });
        return;
    }

    if (error instanceof ApplicationServiceError) {
        writeJson(response, error.status, { error: { code: error.code, ...(error.parameters ? { parameters: error.parameters } : {}) } });
        return;
    }

    writeJson(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: { code: APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED } });
}


export function createLocalService(config: ServerConfig, editorial: EditorialService, services: ApplicationServices, diagnostics?: LocalDiagnostics, current = () => ({ editorial, services }), restoreBackup?: (snapshot: Uint8Array) => Promise<void>, backupTransfers?: BackupBundleTransfers) {
    return createServer(async (request, response) => {
        if (!isPermittedOrigin(request, config)) {
            writeJson(response, HTTP_STATUS.FORBIDDEN, { error: { code: APPLICATION_ERROR.ORIGIN_NOT_PERMITTED } });
            return;
        }

        addCorsHeaders(request, response, config);
        if (handleOptionsRequest(request, response))
            return;

        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        try {
            const application = current();
            const router = createPresentationRouter(application.editorial, application.services, diagnostics, restoreBackup, backupTransfers);
            if (await router.handle(request, response, pathname))
                return;
        } catch (error) {
            writeRequestError(error, request, response, diagnostics);
            return;
        }

        writeJson(response, HTTP_STATUS.NOT_FOUND, { error: { code: APPLICATION_ERROR.RESOURCE_NOT_FOUND } });
    });
}
