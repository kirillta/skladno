import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { aiConnectionsPath, applicationSettingsPath, HTTP_METHOD, HTTP_STATUS } from "@skladno/shared";
import { createLocalService } from "./server.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import { createApplicationServices } from "../application/create-application-services.js";
import { openDatabase } from "../infrastructure/persistence/index.js";
import { createTestPersistence } from "../test-support/test-persistence.js";

// Product scenarios: editorial-workflows.ai-connection-management, editorial-workflows.ai-model-preferences
const testDateTimeFormat = { read: async () => ({ locale: "en" }) };
const testModels = { list: async () => [] as string[] };
const testConnectionId = () => randomUUID();

test("AI connections share environment-variable names, activate independently, and can be removed", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-ai-connections-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = createTestPersistence(database);
    const engines = { resolve: () => undefined };
    const editorial = new EditorialService(repositories.articles, repositories.editorialSessions, repositories.styleCorpus, repositories.editorialArtifacts, engines, false);
    const service = createLocalService({
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: false,
    }, editorial, createApplicationServices({
        articles: repositories.articles,
        settings: repositories.settings,
        styleCorpus: repositories.styleCorpus,
        assistant: repositories.assistant,
        artifacts: repositories.editorialArtifacts,
        engines,
        dateTimeFormat: testDateTimeFormat,
        models: testModels,
        createConnectionId: testConnectionId,
    }));

    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");
    const connectionsUrl = `http://127.0.0.1:${address.port}${aiConnectionsPath}`;

    try {
        const firstResponse = await fetch(connectionsUrl, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ label: "Personal OpenAI", environmentVariableName: "OPENAI_API_KEY" }),
        });
        assert.equal(firstResponse.status, HTTP_STATUS.CREATED);
        const first = await firstResponse.json() as { id: string };

        const sameKeyResponse = await fetch(connectionsUrl, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ label: "OpenCode Zen", provider: "opencode", environmentVariableName: "OPENAI_API_KEY" }),
        });
        assert.equal(sameKeyResponse.status, HTTP_STATUS.CREATED);
        const sameKey = await sameKeyResponse.json() as { id: string };

        const secondResponse = await fetch(connectionsUrl, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ label: "Work OpenAI", environmentVariableName: "WORK_OPENAI_API_KEY" }),
        });
        assert.equal(secondResponse.status, HTTP_STATUS.CREATED);
        const second = await secondResponse.json() as { id: string };

        const deactivated = await fetch(`${connectionsUrl}/${second.id}/active`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ active: false }),
        });
        assert.deepEqual(await deactivated.json(), { id: second.id, provider: "openai", label: "Work OpenAI", credentialSource: { kind: "environment-variable", environmentVariableName: "WORK_OPENAI_API_KEY" }, active: false, status: "unchecked" });
        const removed = await fetch(`${connectionsUrl}/${first.id}`, { method: HTTP_METHOD.DELETE });
        assert.equal(removed.status, HTTP_STATUS.NO_CONTENT);

        const settings = await fetch(`http://127.0.0.1:${address.port}${applicationSettingsPath}`);
        assert.deepEqual((await settings.json() as { connections: { id: string }[] }).connections, [
            { id: sameKey.id, provider: "opencode", label: "OpenCode Zen", credentialSource: { kind: "environment-variable", environmentVariableName: "OPENAI_API_KEY" }, active: true, status: "unchecked" },
            { id: second.id, provider: "openai", label: "Work OpenAI", credentialSource: { kind: "environment-variable", environmentVariableName: "WORK_OPENAI_API_KEY" }, active: false, status: "unchecked" },
        ]);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
