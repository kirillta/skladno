import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { aiConnectionsPath, applicationSettingsPath, defaultGeneralSettings, HTTP_METHOD, HTTP_STATUS, PUBLISH_LIMIT_PROFILE, publishSettingsPath, type Article, type GeneralSettings } from "@skladno/shared";
import { createLocalService } from "./server.js";
import { createApplicationServices } from "../application/create-application-services.js";
import { openDatabase } from "../infrastructure/persistence/index.js";
import { Repositories } from "../infrastructure/persistence/repositories.js";

// Product scenarios: editorial-workflows.ai-connection-management, editorial-workflows.ai-model-preferences, history-and-publishing.publishing-profile-persistence, settings.publish-profile-default

const testDateTimeFormat = { read: async () => ({ locale: "en" }) };
const testModels = { list: async () => [] as string[] };
const testConnectionId = () => randomUUID();

test("article API supports CRUD and revision-aware saves", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-http-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = new Repositories(database);
    const engines = { resolve: () => undefined };
    const service = createLocalService({
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: false,
    }, repositories.articles, repositories.styleCorpus, repositories.editorialSessions, repositories.editorialArtifacts, createApplicationServices(repositories.articles, repositories.settings, repositories.styleCorpus, repositories.assistant, repositories.editorialArtifacts, engines, testDateTimeFormat, testModels, testConnectionId), engines);

    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api/articles`;

    try {
        const createdResponse = await fetch(baseUrl, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Draft", content: "one" }) });
        assert.equal(createdResponse.status, HTTP_STATUS.CREATED);
        const created = await createdResponse.json() as Article;

        const firstDraftResponse = await fetch(`${baseUrl}/${created.id}/draft`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "checkpoint", baseRevisionId: created.currentRevisionId }),
        });
        assert.equal(firstDraftResponse.status, HTTP_STATUS.OK);
        const firstDraft = await firstDraftResponse.json() as { version: number };
        assert.equal(firstDraft.version, 1);

        const secondDraftResponse = await fetch(`${baseUrl}/${created.id}/draft`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "newer checkpoint", baseRevisionId: created.currentRevisionId, expectedDraftVersion: firstDraft.version }),
        });
        assert.equal(secondDraftResponse.status, HTTP_STATUS.OK);
        const secondDraft = await secondDraftResponse.json() as { version: number };
        assert.equal(secondDraft.version, 2);

        const staleDraft = await fetch(`${baseUrl}/${created.id}/draft`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "stale checkpoint", baseRevisionId: created.currentRevisionId, expectedDraftVersion: firstDraft.version }),
        });
        assert.equal(staleDraft.status, HTTP_STATUS.CONFLICT);
        const staleDraftBody = await staleDraft.json() as { error: { code: string }; article: Article; draft: { version: number } };
        assert.equal(staleDraftBody.error.code, "draft_conflict");
        assert.equal(staleDraftBody.article.id, created.id);
        assert.equal(staleDraftBody.article.draft?.version, secondDraft.version);
        assert.equal(staleDraftBody.draft.version, secondDraft.version);

        const savedResponse = await fetch(`${baseUrl}/${created.id}/revisions`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "newer checkpoint", baseRevisionId: created.currentRevisionId, expectedDraftVersion: secondDraft.version }) });
        assert.equal(savedResponse.status, HTTP_STATUS.CREATED);
        const saved = await savedResponse.json() as { id: string };

        const articleAfterPromotion = (await (await fetch(baseUrl)).json() as Article[]).find((item) => item.id === created.id)!;
        assert.equal(articleAfterPromotion.draft, undefined);

        const proposal = await fetch(`${baseUrl}/${created.id}/proposal-acceptances`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ baseRevisionId: saved.id, content: "proposal", provenance: { kind: "accepted-proposal" } }),
        });
        assert.equal(proposal.status, HTTP_STATUS.CREATED);
        const proposalRevision = await proposal.json() as { id: string };

        const revisions = await fetch(`${baseUrl}/${created.id}/revisions`);
        assert.equal(revisions.status, HTTP_STATUS.OK);
        assert.equal((await revisions.json() as unknown[]).length, 3);

        const restored = await fetch(`${baseUrl}/${created.id}/revisions/${proposalRevision.id}/restorations`, { method: HTTP_METHOD.POST });
        assert.equal(restored.status, HTTP_STATUS.CREATED);
        const restoredRevision = await restored.json() as { id: string };

        const conflict = await fetch(`${baseUrl}/${created.id}/revisions`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "stale", baseRevisionId: created.currentRevisionId }) });
        assert.equal(conflict.status, HTTP_STATUS.CONFLICT);

        const renamed = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Renamed draft", language: "es", publishingProfileId: "linkedin-short" }) });
        const updated = await renamed.json() as Article;
        assert.equal(updated.title, "Renamed draft");
        assert.equal(updated.language, "es");
        assert.equal(updated.publishingProfileId, "linkedin-short");
        assert.equal(updated.currentRevisionId, restoredRevision.id);
        assert.equal((await (await fetch(`${baseUrl}/${created.id}/revisions`)).json() as unknown[]).length, 4);

        const emptyPatch = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
        assert.equal(emptyPatch.status, HTTP_STATUS.BAD_REQUEST);

        assert.ok(saved.id);

        const settingsUrl = baseUrl.replace("/api/articles", publishSettingsPath);
        const defaultProfile = await fetch(settingsUrl);
        assert.equal(defaultProfile.status, HTTP_STATUS.OK);
        assert.deepEqual(await defaultProfile.json(), { profileId: PUBLISH_LIMIT_PROFILE.LINKEDIN_POST });

        const savedProfile = await fetch(settingsUrl, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ profileId: PUBLISH_LIMIT_PROFILE.LINKEDIN_SHORT }),
        });
        assert.equal(savedProfile.status, HTTP_STATUS.OK);
        assert.deepEqual(await savedProfile.json(), { profileId: PUBLISH_LIMIT_PROFILE.LINKEDIN_SHORT });

        const reloadedProfile = await fetch(settingsUrl);
        assert.deepEqual(await reloadedProfile.json(), { profileId: PUBLISH_LIMIT_PROFILE.LINKEDIN_SHORT });

        assert.equal((await fetch(baseUrl)).status, HTTP_STATUS.OK);
        assert.equal((await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.DELETE })).status, HTTP_STATUS.NO_CONTENT);
        assert.deepEqual(await (await fetch(baseUrl)).json(), []);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});


test("General settings preserve valid formatting preferences and reject invalid updates", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-settings-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = new Repositories(database);
    const engines = { resolve: () => undefined };
    repositories.setSetting("application-general", { ...defaultGeneralSettings, dateFormat: "day-first-dots", timeZone: "America/Argentina/Buenos_Aires" });
    const service = createLocalService({
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: false,
    }, repositories.articles, repositories.styleCorpus, repositories.editorialSessions, repositories.editorialArtifacts, createApplicationServices(repositories.articles, repositories.settings, repositories.styleCorpus, repositories.assistant, repositories.editorialArtifacts, engines, testDateTimeFormat, testModels, testConnectionId), engines);

    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");
    const settingsUrl = `http://127.0.0.1:${address.port}${applicationSettingsPath}`;

    try {
        const loaded = await fetch(settingsUrl);
        assert.equal(loaded.status, HTTP_STATUS.OK);
        assert.equal((await loaded.json() as { general: GeneralSettings }).general.dateFormat, "day-first-dots");

        const loadedTimeZone = await fetch(settingsUrl);
        assert.equal((await loadedTimeZone.json() as { general: GeneralSettings }).general.timeZone, "America/Argentina/Buenos_Aires");

        repositories.setSetting("application-general", {});
        const legacy = await fetch(settingsUrl);
        assert.equal((await legacy.json() as { general: GeneralSettings }).general.timeZone, "system");

        repositories.setSetting("application-general", { ...defaultGeneralSettings, timeZone: "America/Argentina/Buenos_Aires" });
        const invalid = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, timeZone: "UTC-03:00" }),
        });
        assert.equal(invalid.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((await invalid.json() as { error: { code: string } }).error.code, "invalid_request");
        assert.equal((repositories.getSetting("application-general")?.value as GeneralSettings).timeZone, "America/Argentina/Buenos_Aires");

        const invalidDateFormat = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, dateFormat: "dashes" }),
        });
        assert.equal(invalidDateFormat.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((repositories.getSetting("application-general")?.value as GeneralSettings).timeZone, "America/Argentina/Buenos_Aires");

        const invalidTimeFormat = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, timeFormat: "military" }),
        });
        assert.equal(invalidTimeFormat.status, HTTP_STATUS.BAD_REQUEST);

        repositories.setSetting("application-general", { ...defaultGeneralSettings, dateFormat: "dashes", timeFormat: "military", timeZone: "invalid-zone" });
        const recovered = await fetch(settingsUrl);
        assert.deepEqual((await recovered.json() as { general: GeneralSettings }).general, defaultGeneralSettings);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});


test("AI connections reject duplicate environment-variable names and persist active selection and deletion", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-ai-connections-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = new Repositories(database);
    const engines = { resolve: () => undefined };
    const service = createLocalService({
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: false,
    }, repositories.articles, repositories.styleCorpus, repositories.editorialSessions, repositories.editorialArtifacts, createApplicationServices(repositories.articles, repositories.settings, repositories.styleCorpus, repositories.assistant, repositories.editorialArtifacts, engines, testDateTimeFormat, testModels, testConnectionId), engines);

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

        const duplicate = await fetch(connectionsUrl, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ label: "Duplicate", environmentVariableName: "OPENAI_API_KEY" }),
        });
        assert.equal(duplicate.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((await duplicate.json() as { error: { code: string } }).error.code, "duplicate_ai_connection");

        const secondResponse = await fetch(connectionsUrl, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ label: "Work OpenAI", environmentVariableName: "WORK_OPENAI_API_KEY" }),
        });
        assert.equal(secondResponse.status, HTTP_STATUS.CREATED);
        const second = await secondResponse.json() as { id: string };

        const activeRemoval = await fetch(`${connectionsUrl}/${first.id}`, { method: HTTP_METHOD.DELETE });
        assert.equal(activeRemoval.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((await activeRemoval.json() as { error: { code: string } }).error.code, "active_connection_removal_blocked");

        const selected = await fetch(`${connectionsUrl}/${second.id}/active`, { method: HTTP_METHOD.PUT });
        assert.equal(selected.status, HTTP_STATUS.NO_CONTENT);
        const removed = await fetch(`${connectionsUrl}/${first.id}`, { method: HTTP_METHOD.DELETE });
        assert.equal(removed.status, HTTP_STATUS.NO_CONTENT);

        const settings = await fetch(`http://127.0.0.1:${address.port}${applicationSettingsPath}`);
        assert.deepEqual((await settings.json() as { connections: { id: string }[]; activeConnectionId?: string }).connections, [{ id: second.id, provider: "openai", label: "Work OpenAI", environmentVariableName: "WORK_OPENAI_API_KEY", status: "unchecked" }]);
        assert.equal((await (await fetch(`http://127.0.0.1:${address.port}${applicationSettingsPath}`)).json() as { activeConnectionId?: string }).activeConnectionId, second.id);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
