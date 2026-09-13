import type { EditorialEngineErrorCode } from "./editorial-engine-error-code.js";


export class EditorialEngineError extends Error {
    constructor(
        readonly code: EditorialEngineErrorCode,
        message: string,
    ) {
        super(message);
    }
}
