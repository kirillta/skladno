export interface ServerConfig {
  host: string;
  port: number;
  webOrigin: string;
  /** Reserved for explicit server-side model operations; never pass it to the UI. */
  openAiApiKey?: string;
}

function readPort(value: string | undefined): number {
  if (value === undefined || value === "") return 8787;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SKLADNO_SERVER_PORT must be an integer from 1 to 65535.");
  }
  return port;
}

export function loadServerConfig(environment = process.env): ServerConfig {
  return {
    host: environment.SKLADNO_SERVER_HOST || "127.0.0.1",
    port: readPort(environment.SKLADNO_SERVER_PORT),
    webOrigin: environment.SKLADNO_WEB_ORIGIN || "http://localhost:5173",
    openAiApiKey: environment.OPENAI_API_KEY || undefined,
  };
}
