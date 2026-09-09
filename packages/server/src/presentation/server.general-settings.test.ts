import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applicationSettingsPath, defaultGeneralSettings, HTTP_METHOD, HTTP_STATUS, type GeneralSettings } from "@skladno/shared";
import { createLocalService } from "./server.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import { createApplicationServices } from "../application/create-application-services.js";
import { openDatabase } from "../infrastructure/persistence/index.js";
import { createTestPersistence } from "../test-support/test-persistence.js";

const testDateTimeFormat = { read: async () => ({ locale: "en" }) };
const testModels = { list: async () => [] as string[] };
const testConnectionId = () => randomUUID();

test("General settings preserve valid formatting preferences and reject invalid updates", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-settings-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const repositories = createTestPersistence(database);
    const engines = { resolve: () => undefined };
    const editorial = new EditorialService(repositories.articles, repositories.editorialSessions, repositories.styleCorpus, repositories.editorialArtifacts, engines, false);
    repositories.settings.set("application-general", { ...defaultGeneralSettings, dateFormat: "day-first-dots", timeZone: "America/Argentina/Buenos_Aires" });
    const service = createLocalService({
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: false,
    }, editorial, createApplicationServices(repositories.articles, repositories.settings, repositories.styleCorpus, repositories.assistant, repositories.editorialArtifacts, engines, testDateTimeFormat, testModels, testConnectionId));

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

        repositories.settings.set("application-general", {});
        const legacy = await fetch(settingsUrl);
        assert.equal((await legacy.json() as { general: GeneralSettings }).general.timeZone, "system");

        repositories.settings.set("application-general", { ...defaultGeneralSettings, timeZone: "America/Argentina/Buenos_Aires" });
        const invalid = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, timeZone: "UTC-03:00" }),
        });
        assert.equal(invalid.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((await invalid.json() as { error: { code: string } }).error.code, "invalid_request");
        assert.equal((repositories.settings.get("application-general")?.value as GeneralSettings).timeZone, "America/Argentina/Buenos_Aires");

        const invalidTheme = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, theme: "high-contrast" }),
        });
        assert.equal(invalidTheme.status, HTTP_STATUS.BAD_REQUEST);

        const invalidDateFormat = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, dateFormat: "dashes" }),
        });
        assert.equal(invalidDateFormat.status, HTTP_STATUS.BAD_REQUEST);
        assert.equal((repositories.settings.get("application-general")?.value as GeneralSettings).timeZone, "America/Argentina/Buenos_Aires");

        const invalidTimeFormat = await fetch(`${settingsUrl}/general`, {
            method: HTTP_METHOD.PUT,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...defaultGeneralSettings, timeFormat: "military" }),
        });
        assert.equal(invalidTimeFormat.status, HTTP_STATUS.BAD_REQUEST);

        repositories.settings.set("application-general", { ...defaultGeneralSettings, theme: "high-contrast", dateFormat: "dashes", timeFormat: "military", timeZone: "invalid-zone" });
        const recovered = await fetch(settingsUrl);
        assert.deepEqual((await recovered.json() as { general: GeneralSettings }).general, defaultGeneralSettings);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
