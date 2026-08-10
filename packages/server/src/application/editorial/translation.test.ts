import assert from "node:assert/strict";
import test from "node:test";

import { protectArticleSpans, restoreProtectedSpans } from "./translation.js";


test("translation protection restores URLs, code, and technical names exactly", () => {
    const protectedArticle = protectArticleSpans("Read https://example.com/docs and run `npm test` with Node.js.");

    assert.equal(protectedArticle.protectedSpans.length, 3);
    assert.equal(restoreProtectedSpans("Lee [[SKLADNO_PROTECTED_0]] y ejecuta [[SKLADNO_PROTECTED_1]] con [[SKLADNO_PROTECTED_2]].", protectedArticle.protectedSpans), "Lee https://example.com/docs y ejecuta `npm test` con Node.js.");
});


test("translation protection rejects missing or repeated protected tokens", () => {
    const protectedArticle = protectArticleSpans("Open https://example.com.");

    assert.equal(restoreProtectedSpans("Abre el enlace.", protectedArticle.protectedSpans), undefined);
    assert.equal(restoreProtectedSpans("[[SKLADNO_PROTECTED_0]] [[SKLADNO_PROTECTED_0]]", protectedArticle.protectedSpans), undefined);
});
