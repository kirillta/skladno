import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";


const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const PREVIEW_VERSION = /^(\d+)\.(\d+)\.(\d+)-preview\.(\d+)$/;
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";


export function nextReleaseVersion(currentVersion, preview, requestedVersion, existingVersions = []) {
    const current = currentVersion.match(PREVIEW_VERSION) ?? currentVersion.match(STABLE_VERSION);
    assert(current, `Current version ${currentVersion} is not a supported SemVer.`);

    if (!preview) {
        if (requestedVersion) {
            assert.match(requestedVersion, STABLE_VERSION, "Expected an x.y.z version.");
            return requestedVersion;
        }

        return `${current[1]}.${current[2]}.${Number(current[3]) + 1}`;
    }

    const baseVersion = requestedVersion ?? `${current[1]}.${current[2]}.${current[3]}`;
    assert.match(baseVersion, STABLE_VERSION, "Expected an x.y.z version.");
    const previewNumbers = existingVersions
        .map((version) => version.match(PREVIEW_VERSION))
        .filter((match) => match && `${match[1]}.${match[2]}.${match[3]}` === baseVersion)
        .map((match) => Number(match[4]));

    if (currentVersion.startsWith(`${baseVersion}-preview.`))
        previewNumbers.push(Number(current[4]));

    return `${baseVersion}-preview.${Math.max(0, ...previewNumbers) + 1}`;
}


function run(command, args, options = {}) {
    return execFileSync(command, args, { encoding: "utf8", stdio: "inherit", ...options });
}


function release() {
    assert.equal(run("git", ["status", "--porcelain"], { stdio: "pipe" }).trim(), "", "Commit or stash existing changes before releasing.");
    run("git", ["fetch", "origin", "--tags", "--quiet"]);

    const { version: currentVersion } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const tags = run("git", ["tag", "--list", "v*"], { stdio: "pipe" })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((tag) => tag.slice(1));
    const mode = process.argv[2];
    assert.match(mode, /^(stable|preview)$/, "Release mode must be stable or preview.");
    const version = nextReleaseVersion(currentVersion, mode === "preview", process.argv[3], tags);
    const tag = `v${version}`;

    run(NPM, ["pkg", "set", `version=${version}`]);
    run(NPM, ["pkg", "set", `version=${version}`, "--workspace", "@skladno/electron"]);
    run(NPM, ["install", "--package-lock-only", "--ignore-scripts"]);
    run("node", ["scripts/check-electron-release-tag.mjs", tag]);
    run(NPM, ["run", "verify"]);
    run("git", ["add", "package.json", "package-lock.json", "packages/electron/package.json"]);
    run("git", ["commit", "-m", `Release ${tag}`]);
    run("git", ["tag", tag]);
    run("git", ["push", "--atomic", "origin", "HEAD", tag]);
}


if (process.argv[1] && new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href === import.meta.url)
    release();
