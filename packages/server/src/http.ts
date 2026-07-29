import { createServer, type IncomingMessage } from "node:http";
import { HTTP_METHOD, HTTP_STATUS } from "@skladno/shared";

import type { ServerConfig } from "./config.js";
import { LangChainEditorialEngine } from "./editorial/langchain-editorial-engine.js";
import type { EditorialEngine } from "./editorial/editorial-engine.js";
import { handleDocumentsRoute } from "./http/routes/documents-route.js";
import { handleEditorialRoute } from "./http/routes/editorial-route.js";
import { handleHealthRoute } from "./http/routes/health-route.js";
import { handlePublishSettingsRoute } from "./http/routes/publish-settings-route.js";
import { handleStyleCorpusRoute } from "./http/routes/style-corpus-route.js";
import { writeJson } from "./http/json.js";
import { DocumentConflictError, Repositories } from "./persistence/index.js";


function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
    return request.headers.origin === undefined || request.headers.origin === config.webOrigin;
}


export function createLocalService(config: ServerConfig, repositories: Repositories, engine: EditorialEngine | undefined = config.openAiApiKey ? new LangChainEditorialEngine({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    storeResponses: config.openAiStoreResponses,
}) : undefined) {
    return createServer(async (request, response) => {
        if (!isPermittedOrigin(request, config)) {
            writeJson(response, HTTP_STATUS.FORBIDDEN, { error: "Origin is not permitted." });
            return;
        }
        
        if (request.headers.origin === config.webOrigin) {
            response.setHeader("access-control-allow-origin", config.webOrigin);
            response.setHeader("vary", "Origin");
        }

        if (request.method === HTTP_METHOD.OPTIONS) {
            response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
            response.setHeader("access-control-allow-headers", "content-type");
            response.writeHead(HTTP_STATUS.NO_CONTENT);
            response.end();
        
            return;
        }

        if (handleHealthRoute(request, response))
            return;

        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        try {
            if (await handleEditorialRoute(request, response, pathname, config, repositories, engine))
                return;

            if (await handleStyleCorpusRoute(request, response, pathname, repositories))
                return;

            if (await handlePublishSettingsRoute(request, response, pathname, repositories))
                return;

            if (await handleDocumentsRoute(request, response, pathname, repositories))
                return;
        } catch (error) {
            if (error instanceof DocumentConflictError) {
                writeJson(response, HTTP_STATUS.CONFLICT, { error: error.message, document: error.document });
                return;
            }
            const message = error instanceof Error ? error.message : "Invalid request.";
            writeJson(response, message === "Document not found." ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST, { error: message });
            
            return;
        }
        
        writeJson(response, HTTP_STATUS.NOT_FOUND, { error: "Not found." });
    });
}
