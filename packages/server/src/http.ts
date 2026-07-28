import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { documentsPath, healthPath, type CreateDocumentInput, type HealthResponse, type SaveDocumentDraftInput } from "@skladno/shared";

import type { ServerConfig } from "./config.js";
import { DocumentConflictError, Repositories } from "./persistence/index.js";

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 1_000_000) throw new Error("Request body is too large.");
  }
  try { return JSON.parse(body); } catch { throw new Error("Request body must be valid JSON."); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body must be an object.");
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  return value;
}

function isPermittedOrigin(request: IncomingMessage, config: ServerConfig): boolean {
  const origin = request.headers.origin;
  return origin === undefined || origin === config.webOrigin;
}

export function createLocalService(config: ServerConfig, repositories: Repositories) {
  return createServer(async (request, response) => {
    if (!isPermittedOrigin(request, config)) {
      writeJson(response, 403, { error: "Origin is not permitted." });
      return;
    }

    if (request.headers.origin === config.webOrigin) {
      response.setHeader("access-control-allow-origin", config.webOrigin);
      response.setHeader("vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type");
      response.writeHead(204); response.end(); return;
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

    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    try {
      if (request.method === "GET" && pathname === documentsPath) {
        writeJson(response, 200, repositories.listDocuments()); return;
      }
      if (request.method === "POST" && pathname === documentsPath) {
        const body = object(await readJson(request));
        const input: CreateDocumentInput = { title: string(body.title, "title"), content: string(body.content, "content") };
        writeJson(response, 201, repositories.createDocument(input)); return;
      }
      const match = /^\/api\/documents\/([^/]+)(?:\/(draft))?$/.exec(pathname);
      if (match) {
        const documentId = decodeURIComponent(match[1]);
        if (request.method === "DELETE" && !match[2]) { repositories.deleteDocument(documentId); response.writeHead(204); response.end(); return; }
        if (request.method === "PATCH" && !match[2]) {
          const body = object(await readJson(request));
          writeJson(response, 200, repositories.renameDocument(documentId, string(body.title, "title"))); return;
        }
        if (request.method === "PUT" && match[2] === "draft") {
          const body = object(await readJson(request));
          const input: SaveDocumentDraftInput = { content: string(body.content, "content"), baseVersionId: string(body.baseVersionId, "baseVersionId") };
          writeJson(response, 200, repositories.saveDraft(documentId, input)); return;
        }
      }
    } catch (error) {
      if (error instanceof DocumentConflictError) { writeJson(response, 409, { error: error.message, document: error.document }); return; }
      const message = error instanceof Error ? error.message : "Invalid request.";
      const status = message === "Document not found." ? 404 : 400;
      writeJson(response, status, { error: message }); return;
    }

    writeJson(response, 404, { error: "Not found." });
  });
}
