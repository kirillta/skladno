import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseTag } from "./check-electron-release-tag.mjs";

test("preview security tags require the exact matching package version", () => {
    assert.doesNotThrow(() => validateReleaseTag({ tag: "v1.2.3-preview.4.security", version: "1.2.3-preview.4.security", electronVersion: "1.2.3-preview.4.security" }));
    assert.throws(() => validateReleaseTag({ tag: "v1.2.3-preview.4.security.extra", version: "1.2.3-preview.4.security.extra", electronVersion: "1.2.3-preview.4.security.extra" }));
});
