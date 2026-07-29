import assert from "node:assert/strict";
import test from "node:test";

import { countPublishingCharacters, preparePlainTextForPublishing } from "./publishing.js";

test("publishing preparation removes Markdown artifacts while retaining links and paragraphs", () => {
    const prepared = preparePlainTextForPublishing("# Release notes\n\nRead [the guide](https://example.com/guide).\n\n> **Ready** for `copy`.\n\n---\n\nSecond paragraph.");

    assert.equal(prepared, "Release notes\n\nRead the guide (https://example.com/guide).\n\nReady for copy.\n\nSecond paragraph.");
});


test("publishing character count is Unicode-aware", () => {
    assert.equal(countPublishingCharacters("A🙂"), 2);
});
