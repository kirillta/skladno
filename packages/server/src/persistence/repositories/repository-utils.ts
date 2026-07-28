import { randomUUID } from "node:crypto";

export type Row = Record<string, unknown>;

export const createId = () => randomUUID();
export const now = () => new Date().toISOString();


export function required(value: string, name: string): string {
    if (!value.trim())
        throw new Error(`${name} must not be empty.`);

    return value;
}


export function parseObject(value: unknown): Record<string, unknown> {
    const parsed: unknown = JSON.parse(String(value));
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
        throw new Error("Invalid persisted provenance.");

    return parsed as Record<string, unknown>;
}
