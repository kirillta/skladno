import assert from "node:assert/strict";
import test from "node:test";
import { zodSchema } from "ai";

import { findingSchema } from "./fact-check-schemas.js";


test("Fact Check schema omits unsupported URI format while validating URLs locally", async () => {
    const schema = await zodSchema(findingSchema).jsonSchema;
    assert.doesNotMatch(JSON.stringify(schema), /"format":"uri"/);

    const source = findingSchema.shape.sources.element;
    const citation = { url: "https://example.com/evidence", title: "Source", excerpt: null, quality: "primary", publishedAt: null };
    assert.equal(source.safeParse(citation).success, true);
    assert.equal(source.safeParse({ ...citation, url: "not a URL" }).success, false);
});
