import type { IncomingMessage, ServerResponse } from "node:http";


export function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
}


export async function readJson(request: IncomingMessage): Promise<unknown> {
    let body = "";
    for await (const chunk of request) {
        body += String(chunk);
        if (body.length > 1_000_000)
            throw new Error("Request body is too large.");
    }

    try {
        return JSON.parse(body);
    } catch {
        throw new Error("Request body must be valid JSON.");
    }
}


export function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Request body must be an object.");

    return value as Record<string, unknown>;
}


export function string(value: unknown, field: string): string {
    if (typeof value !== "string")
        throw new Error(`${field} must be a string.`);

    return value;
}
