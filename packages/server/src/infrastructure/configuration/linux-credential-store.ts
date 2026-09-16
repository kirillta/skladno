import { Entry } from "@napi-rs/keyring";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import type { CredentialStore } from "../../application/settings/credential-store.js";


const service = "io.github.kirillta.skladno";


type CredentialEntry = Pick<Entry, "getPassword" | "setPassword" | "deleteCredential">;


/** Linux Secret Service adapter. It deliberately has no plaintext fallback. */
export class LinuxCredentialStore implements CredentialStore {
    constructor(
        private readonly createEntry: (connectionId: string) => CredentialEntry = (connectionId) => new Entry(service, connectionId),
        private readonly platform = process.platform,
    ) { }


    available(): boolean {
        return this.platform === "linux";
    }


    get(connectionId: string): string | undefined {
        return this.run(() => this.createEntry(connectionId).getPassword() ?? undefined);
    }


    set(connectionId: string, value: string): void {
        this.run(() => this.createEntry(connectionId).setPassword(value));
    }


    delete(connectionId: string): void {
        this.run(() => this.createEntry(connectionId).deleteCredential());
    }


    private run<T>(operation: () => T): T {
        if (!this.available())
            throw new ApplicationServiceError(APPLICATION_ERROR.MANAGED_CREDENTIALS_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);

        try {
            return operation();
        } catch {
            throw new ApplicationServiceError(APPLICATION_ERROR.MANAGED_CREDENTIALS_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);
        }
    }
}
