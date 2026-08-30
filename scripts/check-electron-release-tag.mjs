import assert from "node:assert/strict";
import { readFileSync } from "node:fs";


export function validateReleaseTag({ tag, version, electronVersion }) {
    assert.match(version, /^\d+\.\d+\.\d+(-preview\.\d+(\.security)?)?$/, "The root package version must be a stable or preview SemVer.");
    assert.equal(electronVersion, version, "The Electron package version must match the root package version.");
    assert.equal(tag, `v${version}`, `Release tag ${tag ?? "<missing>"} does not match package version v${version}.`);
}


if (process.argv[1] && new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href === import.meta.url) {
    const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
    const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const electronPackage = JSON.parse(readFileSync(new URL("../packages/electron/package.json", import.meta.url), "utf8"));
    validateReleaseTag({ tag, version, electronVersion: electronPackage.version });
}
