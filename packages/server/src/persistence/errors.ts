import type { Document } from "@skladno/shared";

export class DocumentConflictError extends Error {
    constructor(public readonly document: Document) {
        super("Document has a newer version.");
    }
}
