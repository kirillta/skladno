import type { ApplicationErrorCode } from "@skladno/shared";

/** Explicit renderer-safe failure selected where the request is validated. */
export class ApplicationServiceError extends Error {
    constructor(
        public readonly code: ApplicationErrorCode,
        public readonly status: number,
        public readonly parameters?: Record<string, string | number>,
    ) {
        super(code);
        this.name = "ApplicationServiceError";
    }
}
