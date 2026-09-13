export interface PendingRestore {
    complete(): void;
    rollback(): void;
}
