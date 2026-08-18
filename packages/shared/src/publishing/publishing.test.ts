import assert from "node:assert/strict";
import test from "node:test";

import { countPublishingCharacters, getPublishingLength, preparePlainTextForPublishing, publishLimitProfiles } from "./publishing.js";


test("publishing length guidance distinguishes within, near, and over the advisory limit", () => {
    const profile = publishLimitProfiles[1]!;
    assert.ok(profile.warningThreshold !== undefined && profile.characterLimit !== undefined);

    assert.equal(getPublishingLength("a".repeat(profile.warningThreshold - 1), profile).state, "within-limit");
    assert.equal(getPublishingLength("a".repeat(profile.warningThreshold), profile).state, "near-limit");
    assert.equal(getPublishingLength("a".repeat(profile.characterLimit), profile).state, "near-limit");
    assert.deepEqual(getPublishingLength("a".repeat(profile.characterLimit + 1), profile), {
        count: profile.characterLimit + 1,
        remaining: -1,
        state: "over-limit",
    });
});

test("publishing preparation removes Markdown artifacts while retaining links and paragraphs", () => {
    const prepared = preparePlainTextForPublishing("# Release notes\n\nRead [the guide](https://example.com/guide).\n\n> **Ready** for `copy`.\n\n---\n\nSecond paragraph.");

    assert.equal(prepared, "Release notes\n\nRead the guide (https://example.com/guide).\n\nReady for copy.\n\nSecond paragraph.");
});


test("publishing character count is Unicode-aware", () => {
    assert.equal(countPublishingCharacters("A🙂"), 2);
});
