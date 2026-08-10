import type { IncomingMessage, ServerResponse } from "node:http";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";
import { ApplicationServiceError } from "../errors/application-error.js";


export function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
}


export async function readJson(request: IncomingMessage): Promise<unknown> {
    let body = "";
    for await (const chunk of request) {
        body += String(chunk);
        if (body.length > 1_000_000)
            throw new ApplicationServiceError(APPLICATION_ERROR.REQUEST_TOO_LARGE, HTTP_STATUS.BAD_REQUEST);
    }

    try {
        return JSON.parse(body);
    } catch {
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_JSON, HTTP_STATUS.BAD_REQUEST);
    }
}


export function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return value as Record<string, unknown>;
}


export function string(value: unknown, _field: string): string {
    void _field;

    if (typeof value !== "string")
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return value;
}
