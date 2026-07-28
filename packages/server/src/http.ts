import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { healthPath, type HealthResponse } from "@skladno/shared";

import type { ServerConfig } from "./config.js";

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
  const origin = request.headers.origin;
  return origin === undefined || origin === config.webOrigin;
}

export function createLocalService(config: ServerConfig) {
  return createServer((request, response) => {
    if (!isPermittedOrigin(request, config)) {
      writeJson(response, 403, { error: "Origin is not permitted." });
      return;
    }

    if (request.headers.origin === config.webOrigin) {
      response.setHeader("access-control-allow-origin", config.webOrigin);
      response.setHeader("vary", "Origin");
    }

    if (request.method === "GET" && request.url === healthPath) {
      const body: HealthResponse = {
        status: "ok",
        service: "skladno-local-service",
        timestamp: new Date().toISOString(),
      };
      writeJson(response, 200, body);
      return;
    }

    writeJson(response, 404, { error: "Not found." });
  });
}
