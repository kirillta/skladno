import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { HTTP_METHOD, HTTP_STATUS, PUBLISH_LIMIT_PROFILE, publishSettingsPath, type Article } from "@skladno/shared";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";

test("article API supports CRUD and revision-aware saves", async () => {
    const directory = mkdtempSync(join(tmpdir(), "skladno-http-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const service = createLocalService({ 
        host: "127.0.0.1", 
        port: 0, 
        webOrigin: "http://localhost:5173", 
        databasePath: "unused", 
        openAiModel: "gpt-5",
        openAiStoreResponses: false,
    }, new Repositories(database));
    
    service.listen(0, "127.0.0.1");
    await once(service, "listening");
    
    const address = service.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api/articles`;

    try {
        const createdResponse = await fetch(baseUrl, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Draft", content: "one" }) });
        assert.equal(createdResponse.status, HTTP_STATUS.CREATED);
        const created = await createdResponse.json() as Article;

        const savedResponse = await fetch(`${baseUrl}/${created.id}/revisions`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "two", baseRevisionId: created.currentRevisionId }) });
        assert.equal(savedResponse.status, HTTP_STATUS.CREATED);
        const saved = await savedResponse.json() as { id: string };

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

        const conflict = await fetch(`${baseUrl}/${created.id}/revisions`, { method: HTTP_METHOD.POST, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "stale", baseRevisionId: created.currentRevisionId }) });
        assert.equal(conflict.status, HTTP_STATUS.CONFLICT);

        const renamed = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Renamed draft" }) });
        assert.equal((await renamed.json() as Article).title, "Renamed draft");
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
