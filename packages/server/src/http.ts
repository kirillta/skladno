import { createServer, type IncomingMessage } from "node:http";
import { APPLICATION_ERROR, HTTP_METHOD, HTTP_STATUS, type EditorialOperation, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";

import type { ServerConfig } from "./config.js";
import { LangChainEditorialEngine } from "./editorial/langchain-editorial-engine.js";
import type { EditorialEngine } from "./editorial/editorial-engine.js";
import { handleArticlesRoute } from "./http/routes/articles-route.js";
import { handleEditorialRoute } from "./http/routes/editorial-route.js";
import { handleHealthRoute } from "./http/routes/health-route.js";
import { handlePublishSettingsRoute } from "./http/routes/publish-settings-route.js";
import { handleStyleCorpusRoute } from "./http/routes/style-corpus-route.js";
import { handleSettingsRoute } from "./http/routes/settings-route.js";
import { writeJson } from "./http/json.js";
import { ApplicationServiceError } from "./http/application-error.js";
import { ArticleRevisionConflictError, Repositories } from "./persistence/index.js";


function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
    return request.headers.origin === undefined || request.headers.origin === config.webOrigin;
}


export function createLocalService(config: ServerConfig, repositories: Repositories, engine?: EditorialEngine) {
    function resolveEngine(operation: EditorialOperation): EditorialEngine | undefined {
        if (engine)
            return engine;

        const savedConnections = repositories.getSetting("application-ai-connections")?.value as { connections?: OpenAiConnection[]; activeConnectionId?: string } | undefined;
        const active = savedConnections?.connections?.find((connection) => connection.id === savedConnections.activeConnectionId);
        const apiKey = active ? process.env[active.environmentVariableName] : config.openAiApiKey;
        if (!apiKey)
            return undefined;

        const preferences = repositories.getSetting("application-model-preferences")?.value as Partial<ModelPreferences> | undefined;
        const model = preferences?.operationOverrides?.[operation] || preferences?.defaultModel || config.openAiModel;
        return new LangChainEditorialEngine({ apiKey, model, storeResponses: config.openAiStoreResponses });
    }

    return createServer(async (request, response) => {
        if (!isPermittedOrigin(request, config)) {
            writeJson(response, HTTP_STATUS.FORBIDDEN, { error: { code: APPLICATION_ERROR.ORIGIN_NOT_PERMITTED } });
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
            if (await handleEditorialRoute(request, response, pathname, config, repositories, resolveEngine))
                return;

            if (await handleStyleCorpusRoute(request, response, pathname, repositories))
                return;

            if (await handleSettingsRoute(request, response, pathname, repositories))
                return;

            if (await handlePublishSettingsRoute(request, response, pathname, repositories))
                return;

            if (await handleArticlesRoute(request, response, pathname, repositories))
                return;
        } catch (error) {
            if (error instanceof ArticleRevisionConflictError) {
                writeJson(response, HTTP_STATUS.CONFLICT, { error: { code: APPLICATION_ERROR.REVISION_CONFLICT }, article: error.article });
                return;
            }

            if (error instanceof ApplicationServiceError) {
                writeJson(response, error.status, { error: { code: error.code, ...(error.parameters ? { parameters: error.parameters } : {}) } });
                return;
            }

            writeJson(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: { code: APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED } });

            return;
        }

        writeJson(response, HTTP_STATUS.NOT_FOUND, { error: { code: APPLICATION_ERROR.RESOURCE_NOT_FOUND } });
    });
}
