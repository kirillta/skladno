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

        const renamed = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Renamed draft", workflowStage: "fact_checking", language: "es", publishingProfileId: "linkedin-short" }) });
        const updated = await renamed.json() as Article;
        assert.equal(updated.title, "Renamed draft");
        assert.equal(updated.workflowStage, "fact_checking");
        assert.equal(updated.language, "es");
        assert.equal(updated.publishingProfileId, "linkedin-short");
        assert.equal(updated.currentRevisionId, restoredRevision.id);
        assert.equal((await (await fetch(`${baseUrl}/${created.id}/revisions`)).json() as unknown[]).length, 4);

        const emptyPatch = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
        assert.equal(emptyPatch.status, HTTP_STATUS.BAD_REQUEST);

        const invalidStage = await fetch(`${baseUrl}/${created.id}`, { method: HTTP_METHOD.PATCH, headers: { "content-type": "application/json" }, body: JSON.stringify({ workflowStage: "flow" }) });
        assert.equal(invalidStage.status, HTTP_STATUS.BAD_REQUEST);
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
