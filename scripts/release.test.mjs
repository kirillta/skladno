import assert from "node:assert/strict";
import test from "node:test";
import { nextReleaseVersion } from "./release.mjs";


test("chooses stable and preview versions", () => {
    assert.equal(nextReleaseVersion("1.2.3-preview.4", false), "1.2.4");
    assert.equal(nextReleaseVersion("1.2.3", false, "2.0.0"), "2.0.0");
    assert.equal(nextReleaseVersion("1.2.3", true), "1.2.3-preview.1");
    assert.equal(nextReleaseVersion("1.2.3-preview.4", true), "1.2.3-preview.5");
    assert.equal(nextReleaseVersion("1.2.2", true, "1.2.3", ["1.2.3-preview.1"]), "1.2.3-preview.2");
});
