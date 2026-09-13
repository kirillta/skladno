export class PendingRestoreError extends Error {
    constructor(cause: unknown) {
        super(undefined, { cause });
        this.name = "PendingRestoreError";
    }
}
