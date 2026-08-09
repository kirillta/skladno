import { createServer, type IncomingMessage } from "node:http";
import { APPLICATION_ERROR, HTTP_METHOD, HTTP_STATUS } from "@skladno/shared";

import type { ServerConfig } from "../infrastructure/configuration/config.js";
import { createApplicationServices } from "../application/create-application-services.js";
import type { ApplicationServices } from "../application/application-services.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import type { EditorialEngineResolver } from "../application/ports/editorial-engine-resolver.js";
import { ConfiguredEditorialEngineResolver } from "../infrastructure/editorial/configured-editorial-engine-resolver.js";
import { handleArticlesRoute } from "./routes/articles-route.js";
import { handleAssistantRoute } from "./routes/assistant-route.js";
import { handleEditorialRoute } from "./routes/editorial-route.js";
import { handleHealthRoute } from "./routes/health-route.js";
import { handlePublishSettingsRoute } from "./routes/publish-settings-route.js";
import { handleStyleCorpusRoute } from "./routes/style-corpus-route.js";
import { handleSettingsRoute } from "./routes/settings-route.js";
import { writeJson } from "./transport/json.js";
import { ApplicationServiceError } from "./errors/application-error.js";
import { ArticleDraftConflictError, ArticleRevisionConflictError, Repositories } from "../infrastructure/persistence/index.js";


function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
    return request.headers.origin === undefined || request.headers.origin === config.webOrigin;
}


export function createLocalService(config: ServerConfig, repositories: Repositories, engine?: EditorialEngine, services: ApplicationServices = createApplicationServices(repositories)) {
    const { articles, styleCorpus, publishing } = services;

    const engines: EditorialEngineResolver = engine
        ? { resolve: () => engine }
        : new ConfiguredEditorialEngineResolver(config, repositories);
    const resolveEngine = engines.resolve.bind(engines);
    const editorial = new EditorialService(repositories, engines, config.aiSessionContinuationEnabled);

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
            if (await handleAssistantRoute(request, response, pathname, repositories, resolveEngine))
                return;

            if (await handleEditorialRoute(request, response, pathname, editorial))
                return;

            if (await handleStyleCorpusRoute(request, response, pathname, styleCorpus))
                return;

            if (await handleSettingsRoute(request, response, pathname, repositories))
                return;

            if (await handlePublishSettingsRoute(request, response, pathname, publishing))
                return;

            if (await handleArticlesRoute(request, response, pathname, articles))
                return;
        } catch (error) {
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

            return;
        }

        writeJson(response, HTTP_STATUS.NOT_FOUND, { error: { code: APPLICATION_ERROR.RESOURCE_NOT_FOUND } });
    });
}
