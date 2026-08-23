import assert from "node:assert/strict";
import { readFileSync } from "node:fs";


const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const electronPackage = JSON.parse(readFileSync(new URL("../packages/electron/package.json", import.meta.url), "utf8"));

assert.match(version, /^\d+\.\d+\.\d+-preview\.\d+$/, "The root package version must be a preview SemVer.");
assert.equal(electronPackage.version, version, "The Electron package version must match the root package version.");
assert.equal(tag, `v${version}`, `Release tag ${tag ?? "<missing>"} does not match package version v${version}.`);
