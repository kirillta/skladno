/** The stable HTTP route for the service health probe. */
export const healthPath = "/api/health";

/**
 * Transport-neutral representation of the local service state.
 * Future Electron adapters can return this shape without changing the UI.
 */
export interface HealthResponse {
    status: "ok";
    service: "skladno-local-service";
    timestamp: string;
}


/** The narrow interface UI code depends on for application operations. */
export interface ApplicationClient {
    getHealth(): Promise<HealthResponse>;
}


export function isHealthResponse(value: unknown): value is HealthResponse {
    if (typeof value !== "object" || value === null) 
        return false;

    const candidate = value as Record<string, unknown>;
    return (
        candidate.status === "ok" &&
        candidate.service === "skladno-local-service" &&
        typeof candidate.timestamp === "string" &&
        !Number.isNaN(Date.parse(candidate.timestamp))
    );
}

export function parseHealthResponse(value: unknown): HealthResponse {
    if (!isHealthResponse(value)) 
        throw new TypeError("The local service returned an invalid health response.");

    return value;
}
