import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ServerConfig {
    host: string;
    port: number;
    webOrigin: string;
    /** Reserved for explicit server-side model operations; never pass it to the UI. */
    openAiApiKey?: string;
    openAiModel: string;
    openAiStoreResponses: boolean;
    databasePath: string;
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


function rejectRemoteTracing(environment: NodeJS.ProcessEnv): void {
    if (environment.LANGSMITH_TRACING === "true" || environment.LANGCHAIN_TRACING_V2 === "true")
        throw new Error("LangSmith tracing is disabled because Skladno handles private editorial content.");
}


export function loadServerConfig(environment = process.env): ServerConfig {
    rejectRemoteTracing(environment);

    const dataDirectory = environment.SKLADNO_DATA_DIR || join(homedir(), ".skladno");
    mkdirSync(dataDirectory, { recursive: true });

    return {
        host: environment.SKLADNO_SERVER_HOST || "127.0.0.1",
        port: readPort(environment.SKLADNO_SERVER_PORT),
        webOrigin: environment.SKLADNO_WEB_ORIGIN || "http://localhost:5173",
        openAiApiKey: environment.OPENAI_API_KEY || undefined,
        openAiModel: environment.OPENAI_MODEL || "gpt-5",
        openAiStoreResponses: readBoolean(environment.OPENAI_STORE_RESPONSES, "OPENAI_STORE_RESPONSES"),
        databasePath: join(dataDirectory, "skladno.sqlite"),
    };
}
