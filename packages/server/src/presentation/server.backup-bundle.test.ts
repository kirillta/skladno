import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupExportsPath, backupImportsPath, type BackupBundleManifest } from "@skladno/shared";

import { BackupBundleTransfers } from "../infrastructure/persistence/backup-bundle.js";
import { createLocalApplication } from "../local-application.js";
import { createLocalService } from "./server.js";


test("browser backup routes transfer a verified Skill bundle through opaque IDs", async () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-backup-http-"));
    const config = {
        host: "127.0.0.1", port: 0, webOrigin: "http://localhost:5173",
        databasePath: join(root, "skladno.sqlite"), aiModel: "test", aiSessionContinuationEnabled: false,
    };
    const application = createLocalApplication(config);
    const skill = join(root, "skills", "clarity");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "skill content");
    let restored = false;
    const transfers = new BackupBundleTransfers(root, () => application.services.settings.createBackup(), async () => {
        restored = true;
    });
    const service = createLocalService(config, application.editorial, application.services, undefined, undefined, undefined, transfers);
    service.listen(0, config.host);
    await once(service, "listening");
    const address = service.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    try {
        const exportResponse = await fetch(`${base}${backupExportsPath}`, { method: "POST" });
        assert.equal(exportResponse.status, 201);
        const exported = await exportResponse.json() as { id: string; manifest: BackupBundleManifest };
        assert.ok(exported.manifest.files.some((file) => file.path === "skills/clarity/SKILL.md"));

        const importResponse = await fetch(`${base}${backupImportsPath}`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(exported.manifest),
        });
        assert.equal(importResponse.status, 201);
        const imported = await importResponse.json() as { id: string };
        for (const [index] of exported.manifest.files.entries()) {
            const file = await fetch(`${base}${backupExportsPath}/${exported.id}/${index}`);
            assert.equal(file.status, 200);
            const upload = await fetch(`${base}${backupImportsPath}/${imported.id}/${index}`, { method: "PUT", body: await file.arrayBuffer() });
            assert.equal(upload.status, 204);
        }

        const restore = await fetch(`${base}${backupImportsPath}/${imported.id}/restore`, { method: "POST" });
        assert.equal(restore.status, 204);
        assert.equal(restored, true);
        await fetch(`${base}${backupExportsPath}/${exported.id}`, { method: "DELETE" });
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        application.database.close();
        rmSync(root, { recursive: true, force: true });
    }
});
