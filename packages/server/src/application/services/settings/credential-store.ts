export interface CredentialStore {
    available(): boolean;
    get(connectionId: string): string | undefined;
    set(connectionId: string, value: string): void;
    delete(connectionId: string): void;
}
