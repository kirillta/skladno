import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";


export interface ServerConfig {
    host: string;
    port: number;
    webOrigin: string;
    /** Reserved for explicit server-side AI operations; never pass it to the UI. */
    aiApiKey?: string;
    aiModel: string;
    aiSessionContinuationEnabled: boolean;
    databasePath: string;
}


const projectEnvironmentFile = fileURLToPath(new URL("../../../../../.env", import.meta.url));


export function loadServerEnvironment(path = projectEnvironmentFile): void {
    if (existsSync(path))
        process.loadEnvFile(path);
}


function readPort(value: string | undefined): number {
    if (value === undefined || value === "")
        return 8787;

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65_535)
        throw new Error("SKLADNO_SERVER_PORT must be an integer from 1 to 65535.");

    return port;
}


function readBoolean(value: string | undefined, name: string): boolean {
    if (value === undefined || value === "")
        return false;

    if (value === "true")
        return true;

    if (value === "false")
        return false;

    throw new Error(`${name} must be either true or false.`);
}


export function loadServerConfig(environment = process.env): ServerConfig {
    const dataDirectory = environment.SKLADNO_DATA_DIR || join(homedir(), ".skladno");
    mkdirSync(dataDirectory, { recursive: true });

    return {
        host: environment.SKLADNO_SERVER_HOST || "127.0.0.1",
        port: readPort(environment.SKLADNO_SERVER_PORT),
        webOrigin: environment.SKLADNO_WEB_ORIGIN || "http://localhost:5173",
        aiApiKey: environment.SKLADNO_AI_API_KEY || undefined,
        aiModel: environment.SKLADNO_AI_MODEL || "gpt-5",
        aiSessionContinuationEnabled: readBoolean(environment.SKLADNO_AI_SESSION_CONTINUATION, "SKLADNO_AI_SESSION_CONTINUATION"),
        databasePath: join(dataDirectory, "skladno.sqlite"),
    };
}
