import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { loadServerConfig, loadServerEnvironment } from "./config.js";


// product: cross-cutting.private-storage-opt-in

function withConfigEnvironment(values: Record<string, string | undefined>, run: (environment: NodeJS.ProcessEnv) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-config-"));
    const environment: NodeJS.ProcessEnv = {
        SKLADNO_DATA_DIR: directory,
        ...values,
    };

    try {
        run(environment);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}


test("AI session continuation is disabled unless explicitly enabled", () => {
    withConfigEnvironment({}, (environment) => {
        assert.equal(loadServerConfig(environment).aiSessionContinuationEnabled, false);
    });

    withConfigEnvironment({ SKLADNO_AI_SESSION_CONTINUATION: "true" }, (environment) => {
        assert.equal(loadServerConfig(environment).aiSessionContinuationEnabled, true);
    });

    withConfigEnvironment({ SKLADNO_AI_SESSION_CONTINUATION: "false" }, (environment) => {
        assert.equal(loadServerConfig(environment).aiSessionContinuationEnabled, false);
    });
});


test("the local service loads custom named keys from the project environment file", () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-environment-"));
    const environmentFile = join(directory, ".env");
    const variableName = "SKLADNO_TEST_AI_KEY";
    const previous = process.env[variableName];
    writeFileSync(environmentFile, `${variableName}=test-key\n`);

    try {
        delete process.env[variableName];
        loadServerEnvironment(environmentFile);
        assert.equal(process.env[variableName], "test-key");
    } finally {
        if (previous === undefined)
            delete process.env[variableName];
        else
            process.env[variableName] = previous;

        rmSync(directory, { recursive: true, force: true });
    }
});


test("AI session continuation configuration rejects ambiguous values", () => {
    withConfigEnvironment({ SKLADNO_AI_SESSION_CONTINUATION: "yes" }, (environment) => {
        assert.throws(() => loadServerConfig(environment), /SKLADNO_AI_SESSION_CONTINUATION must be either true or false/);
    });
});


test("the local data directory is owner-only on POSIX", { skip: process.platform === "win32" }, () => {
    withConfigEnvironment({}, (environment) => {
        chmodSync(environment.SKLADNO_DATA_DIR!, 0o755);
        const { databasePath } = loadServerConfig(environment);
        const dataDirectory = dirname(databasePath);
        assert.equal(statSync(dataDirectory).mode & 0o777, 0o700);
    });
});
