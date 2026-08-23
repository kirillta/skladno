import { Entry } from "@napi-rs/keyring";
import { APPLICATION_ERROR, HTTP_STATUS } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import type { ManagedCredentials } from "../../application/ports/managed-credentials.js";


const service = "io.github.kirillta.skladno";


/** Windows Credential Manager adapter. It deliberately has no plaintext fallback. */
export class WindowsManagedCredentials implements ManagedCredentials {
    available(): boolean {
        return process.platform === "win32";
    }


    get(connectionId: string): string | undefined {
        return this.entry(connectionId)?.getPassword() ?? undefined;
    }


    set(connectionId: string, value: string): void {
        const entry = this.entry(connectionId);
        if (!entry)
            throw new ApplicationServiceError(APPLICATION_ERROR.MANAGED_CREDENTIALS_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);

        entry.setPassword(value);
    }


    delete(connectionId: string): void {
        const entry = this.entry(connectionId);
        if (!entry)
            throw new ApplicationServiceError(APPLICATION_ERROR.MANAGED_CREDENTIALS_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST);

        entry.deleteCredential();
    }


    private entry(connectionId: string): Entry | undefined {
        return this.available() ? new Entry(service, connectionId) : undefined;
    }
}
