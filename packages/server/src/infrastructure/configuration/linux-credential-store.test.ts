import assert from "node:assert/strict";
import test from "node:test";

import { APPLICATION_ERROR } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import { LinuxCredentialStore } from "./linux-credential-store.js";


test("Linux Secret Service failures stay renderer-safe", () => {
    const store = new LinuxCredentialStore(() => ({
        getPassword: () => {
            throw new Error("D-Bus unavailable");
        },
        setPassword: () => {
            throw new Error("D-Bus unavailable");
        },
        deleteCredential: () => {
            throw new Error("D-Bus unavailable");
        },
    }), "linux");

    assert.throws(
        () => store.set("connection", "secret"),
        (error: unknown) => error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.MANAGED_CREDENTIALS_UNAVAILABLE,
    );
});
