import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SkillRevisionStore } from "../../../infrastructure/skills/skill-revision-store.js";
import { AuthorSkillService } from "./author-skill-service.js";
import { FileAssistantSkillSource } from "./file-assistant-skill-source.js";
import { builtInSkillSource } from "./built-in-skill-source.js";


const initial = "---\nid: author-review\nname: Author review\ndescription: Review a draft with the Author's editorial preferences.\nversion: 1\n---\n# Review\n";
const revised = initial.replace("version: 1", "version: 2").replace("# Review", "# Revised review");


test("Skill Creator supplies a package example that the real store accepts", () => {
    const creator = builtInSkillSource.summaries().find((skill) => skill.reference.id === "skill_creator");
    assert.ok(creator);
    const instructions = builtInSkillSource.load(creator.reference)?.instructions ?? "";
    const markdown = /```markdown\r?\n([\s\S]*?)```/.exec(instructions)?.[1];
    assert.ok(markdown, "The model needs the required package metadata format");
    const root = mkdtempSync(join(tmpdir(), "skladno-creator-example-"));
    const source = new FileAssistantSkillSource("author", join(root, "skills"));
    const service = new AuthorSkillService(source, new SkillRevisionStore(root));
    try {
        service.create({ skillId: "concise-review", files: { "SKILL.md": markdown } });
        assert.equal(service.listRevisions("concise-review").length, 1);
        assert.ok(source.get("concise-review"));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


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

        const recovered = service.restore({ skillId: "author-review", revisionId: created.id, expectedHash: "" });
        assert.equal(source.get("author-review")?.reference.version, "4");
        assert.equal(source.get("author-review")?.instructions, "# Review");
        assert.equal(service.listRevisions("author-review").at(-1)?.id, recovered.id);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("a failed chat completion can roll back a Skill revision", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-rollback-"));
    const source = new FileAssistantSkillSource("author", join(root, "skills"));
    const service = new AuthorSkillService(source, new SkillRevisionStore(root));
    try {
        service.create({ skillId: "author-review", files: { "SKILL.md": initial } });
        const expectedHash = service.readCurrent("author-review")!.contentHash;
        assert.throws(() => service.validateChange({ kind: "update", skillId: "author-review", skillMarkdown: revised, expectedHash: "wrong" }), /skill_package_conflict/);

        const change = service.commitChange({ kind: "update", skillId: "author-review", skillMarkdown: revised, expectedHash }, "request-2");
        assert.equal(service.listRevisions("author-review").length, 2);
        service.rollbackChange(change);

        assert.equal(service.readCurrent("author-review")?.files["SKILL.md"], initial);
        assert.equal(service.listRevisions("author-review").length, 1);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("chat revision preserves bundled references", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-author-skill-references-"));
    const source = new FileAssistantSkillSource("author", join(root, "skills"));
    const service = new AuthorSkillService(source, new SkillRevisionStore(root));
    const markdown = initial.replace("version: 1", "version: 1\nreferences:\n  - references/guide.md");
    try {
        service.create({ skillId: "author-review", files: { "SKILL.md": markdown, "references/guide.md": "Keep citations." } });
        const change = { kind: "update" as const, skillId: "author-review", skillMarkdown: markdown.replace("# Review", "# Revised review"), expectedHash: service.readCurrent("author-review")!.contentHash };
        service.commitChange(change, "request-2");

        assert.equal(service.readCurrent("author-review")?.files["references/guide.md"], "Keep citations.");
        assert.equal(service.listRevisions("author-review").length, 2);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
