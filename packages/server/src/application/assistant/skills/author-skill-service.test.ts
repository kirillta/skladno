import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SkillRevisionStore } from "../../../infrastructure/skills/skill-revision-store.js";
import { AuthorSkillService } from "./author-skill-service.js";
import { FileAssistantSkillSource } from "./file-assistant-skill-source.js";


const initial = "---\nid: author-review\nname: Author review\ndescription: Review a draft with the Author's editorial preferences.\nversion: 1\n---\n# Review\n";
const revised = initial.replace("version: 1", "version: 2").replace("# Review", "# Revised review");


test("creates, updates, restores and deletes Author Skills without deleting their history", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skills-"));
    const ids = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
    ];
    const source = new FileAssistantSkillSource("author", join(root, "skills"));
    const service = new AuthorSkillService(source, new SkillRevisionStore(root, () => new Date("2026-09-21T12:00:00.000Z"), () => ids.shift() ?? "44444444-4444-4444-8444-444444444444"));
    try {
        const created = service.create({ skillId: "author-review", files: { "SKILL.md": initial }, requestId: "request-1" });
        const updated = service.update({ skillId: "author-review", files: { "SKILL.md": revised }, expectedHash: source.get("author-review")!.contentHash! });
        const restored = service.restore({ skillId: "author-review", revisionId: created.id, expectedHash: source.get("author-review")!.contentHash! });

        assert.equal(source.get("author-review")?.instructions, "# Review");
        assert.equal(source.get("author-review")?.reference.version, "3");
        assert.deepEqual(service.listRevisions("author-review").map((revision) => revision.id), [created.id, updated.id, restored.id]);

        service.delete({ skillId: "author-review", expectedHash: source.get("author-review")!.contentHash! });
        assert.equal(source.get("author-review"), undefined);
        assert.equal(service.listRevisions("author-review").length, 3);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
