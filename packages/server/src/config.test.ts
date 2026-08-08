import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadServerConfig } from "./config.js";

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


test("response storage is disabled unless explicitly enabled", () => {
    withConfigEnvironment({}, (environment) => {
        assert.equal(loadServerConfig(environment).openAiStoreResponses, false);
    });

    withConfigEnvironment({ OPENAI_STORE_RESPONSES: "true" }, (environment) => {
        assert.equal(loadServerConfig(environment).openAiStoreResponses, true);
    });

    withConfigEnvironment({ OPENAI_STORE_RESPONSES: "false" }, (environment) => {
        assert.equal(loadServerConfig(environment).openAiStoreResponses, false);
    });
});


test("response storage configuration rejects ambiguous values", () => {
    withConfigEnvironment({ OPENAI_STORE_RESPONSES: "yes" }, (environment) => {
        assert.throws(() => loadServerConfig(environment), /OPENAI_STORE_RESPONSES must be either true or false/);
    });
});


test("remote LangSmith tracing is rejected for private editorial content", () => {
    withConfigEnvironment({ LANGSMITH_TRACING: "true" }, (environment) => {
        assert.throws(() => loadServerConfig(environment), /LangSmith tracing is disabled/);
    });

    withConfigEnvironment({ LANGCHAIN_TRACING_V2: "true" }, (environment) => {
        assert.throws(() => loadServerConfig(environment), /LangSmith tracing is disabled/);
    });
});
