import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";


const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const checker = resolve(scriptDirectory, "product-model.mjs");
const schema = resolve(scriptDirectory, "..", "product-model", "schema", "product-area.schema.json");


async function fixture(marker) {
    const root = await mkdtemp(resolve(tmpdir(), "skladno-product-model-"));
    await mkdir(resolve(root, "product-model", "areas"), { recursive: true });
    await mkdir(resolve(root, "product-model", "schema"), { recursive: true });
    await mkdir(resolve(root, "docs", "development", "product"), { recursive: true });
    await mkdir(resolve(root, "packages", "example", "src"), { recursive: true });
    await cp(schema, resolve(root, "product-model", "schema", "product-area.schema.json"));
    await writeFile(resolve(root, "packages", "example", "package.json"), JSON.stringify({ scripts: { test: "node --test src/**/*.test.mjs" } }));
    await writeFile(resolve(root, "packages", "example", "src", "example.test.mjs"), `// product: ${marker}\n`);
    await writeFile(resolve(root, "product-model", "areas", "example.json"), JSON.stringify({
        schemaVersion: 2,
        area: "example",
        capabilities: [{
            id: "example.capability",
            area: "Example",
            title: "Example capability",
            status: "implemented",
            owners: ["packages/example/src"],
            contract: "The example remains available.",
            persistence: "No persistence.",
        }],
        scenarios: [{
            id: "example.scenario",
            title: "Example scenario",
            capabilityIds: ["example.capability"],
            preconditions: ["The example exists."],
            event: "The example runs.",
            expected: ["The example succeeds."],
            forbidden: ["The example disappears."],
            evidence: { kind: "automated", path: "packages/example/src/example.test.mjs" },
        }],
    }));

    spawnSync(process.execPath, [checker, "generate"], { cwd: root });
    return root;
}


test("product checker accepts linked scenarios and rejects unknown markers", async (context) => {
    const validRoot = await fixture("example.scenario");
    const invalidRoot = await fixture("example.scenario, example.unknown");
    context.after(() => Promise.all([validRoot, invalidRoot].map((root) => rm(root, { recursive: true, force: true }))));

    const valid = spawnSync(process.execPath, [checker, "check"], { cwd: validRoot, encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stderr);

    const invalid = spawnSync(process.execPath, [checker, "check"], { cwd: invalidRoot, encoding: "utf8" });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /references unknown product scenario example\.unknown/);
});
