import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileAssistantSkillSource } from "./file-assistant-skill-source.js";
import { parseSkillPackage } from "./skill-package-parser.js";


const validSkill = "---\nid: author-review\nname: Author review\ndescription: Review a draft with the Author's editorial preferences.\nversion: 1\nreferences:\n  - references/guidance.md\n---\n# Review\n\nKeep the Author in control.\n";


test("Author Skill packages validate, refresh after edits, and isolate invalid packages", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skills-"));
    try {
        const source = new FileAssistantSkillSource("author", root, () => ({ ids: ["flow_and_clarity"], names: ["Flow and Clarity"] }));
        const installed = source.install({ directory: "author-review", files: { "SKILL.md": validSkill, "references/guidance.md": "Use concise feedback." } });
        assert.equal(source.summaries()[0]?.reference.id, "author-review");
        assert.match(source.load(installed.reference)?.references?.[0] ?? "", /concise/);
        writeFileSync(join(root, "broken.md"), "not a package");
        assert.equal(source.summaries().length, 1);
        assert.equal(source.status().length, 1);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


test("Skill validation returns a renderer-owned message ID, not server-authored copy", () => {
    const root = mkdtempSync(join(tmpdir(), "skladno-skills-"));
    try {
        writeFileSync(join(root, "SKILL.md"), "# Missing frontmatter");
        const result = parseSkillPackage({ root, source: "author" });
        assert.deepEqual(result, { ok: false, issues: [{ code: "invalid_frontmatter", messageId: "skills.validation.invalid_frontmatter" }] });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
