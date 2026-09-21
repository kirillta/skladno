import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SkillRevisionStore } from "./skill-revision-store.js";


test("records immutable Author Skill package snapshots", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skill-history-"));
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const store = new SkillRevisionStore(root, () => new Date("2026-09-21T12:00:00.000Z"), () => ids.shift() ?? "33333333-3333-4333-8333-333333333333");
    try {
        const initial = store.create({
            skillId: "author-review",
            contentHash: "initial-hash",
            files: { "SKILL.md": "# Review", "references/style.md": "Be concise." },
            requestId: "request-1",
        });
        const replacement = store.create({
            skillId: "author-review",
            contentHash: "replacement-hash",
            files: { "SKILL.md": "# Revised review" },
            parentId: initial.id,
            restoredFromId: initial.id,
        });

        assert.deepEqual(store.list("author-review").map(({ id, contentHash, parentId }) => ({ id, contentHash, parentId })), [
            { id: initial.id, contentHash: "initial-hash", parentId: undefined },
            { id: replacement.id, contentHash: "replacement-hash", parentId: initial.id },
        ]);
        assert.deepEqual(store.readFiles({ skillId: "author-review", revisionId: initial.id }), {
            "SKILL.md": "# Review",
            "references/style.md": "Be concise.",
        });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("does not read a snapshot through a mismatched Skill identity", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skill-history-"));
    const store = new SkillRevisionStore(root, () => new Date("2026-09-21T12:00:00.000Z"), () => "11111111-1111-4111-8111-111111111111");
    try {
        const revision = store.create({ skillId: "author-review", contentHash: "hash", files: { "SKILL.md": "# Review" } });
        assert.equal(store.readFiles({ skillId: "other-review", revisionId: revision.id }), undefined);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
