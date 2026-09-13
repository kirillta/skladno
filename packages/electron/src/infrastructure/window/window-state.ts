import { readFileSync, writeFileSync } from "node:fs";


const defaultBounds: Electron.Rectangle = { x: 120, y: 80, width: 1440, height: 900 };


function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function parseBounds(value: unknown): Electron.Rectangle | undefined {
    if (!isRecord(value))
        return undefined;

    const { x, y, width, height } = value;
    if (![x, y, width, height].every(Number.isFinite) || typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number")
        return undefined;

    if (width < 900 || height < 640)
        return undefined;

    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}


function intersects(first: Electron.Rectangle, second: Electron.Rectangle): boolean {
    return first.x < second.x + second.width
        && first.x + first.width > second.x
        && first.y < second.y + second.height
        && first.y + first.height > second.y;
}


export function safeWindowBounds(stored: unknown, displays: readonly Electron.Rectangle[]): Electron.Rectangle {
    const bounds = parseBounds(stored);
    if (bounds && displays.some((display) => intersects(bounds, display)))
        return bounds;

    const display = displays[0];
    if (!display)
        return defaultBounds;

    const width = Math.min(defaultBounds.width, display.width);
    const height = Math.min(defaultBounds.height, display.height);

    return {
        x: display.x + Math.round((display.width - width) / 2),
        y: display.y + Math.round((display.height - height) / 2),
        width,
        height,
    };
}


export function readWindowBounds(path: string, displays: readonly Electron.Rectangle[]): Electron.Rectangle {
    try {
        return safeWindowBounds(JSON.parse(readFileSync(path, "utf8")), displays);
    } catch {
        return safeWindowBounds(undefined, displays);
    }
}


export function writeWindowBounds(path: string, bounds: Electron.Rectangle): void {
    writeFileSync(path, JSON.stringify(bounds), { encoding: "utf8", mode: 0o600 });
}
