import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { getBuiltInSkillRoot } from "./desktop-skill-path.js";


test("development and packaged Electron resolve built-in Skills from application roots", () => {
    const appPath = fileURLToPath(new URL("../../", import.meta.url));
    const resourcesPath = resolve(appPath, "test-resources");
    const root = getBuiltInSkillRoot({ packaged: false, appPath, resourcesPath });
    assert.ok(existsSync(root), "Development Skills must be available after bundling");
    const packages = readdirSync(root);
    assert.ok(packages.includes("skill-creator"));
    for (const directory of packages)
        assert.ok(existsSync(join(root, directory, "SKILL.md")));

    assert.equal(getBuiltInSkillRoot({ packaged: true, appPath, resourcesPath }), join(resourcesPath, "built-in"));
});


test("desktop shell does not install native menu chrome", () => {
    const source = readFileSync(new URL("main.ts", import.meta.url), "utf8");

    assert.match(source, /Menu\.setApplicationMenu\(null\)/);
});


test("updating bypasses the ordinary Draft-checkpoint close flow after teardown", () => {
    const source = readFileSync(new URL("main.ts", import.meta.url), "utf8");

    assert.match(source, /window\.on\("close", \(event\) => \{\s+if \(closing\)\s+return;/);
    assert.match(source, /application\.database\.close\(\);\s+closing = true;/);
});
