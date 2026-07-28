import assert from "node:assert/strict";
import test from "node:test";

import { applyProposalChanges, createTextProposal } from "./revisions.js";


test("line proposals represent additions, deletions, replacements, and no-op proposals", () => {
    const addition = createTextProposal("one\nthree", "one\ntwo\nthree");
    assert.equal(addition.changes.length, 1);
    assert.equal(applyProposalChanges(addition, new Set([addition.changes[0].id])), "one\ntwo\nthree");

    const deletion = createTextProposal("one\ntwo\nthree", "one\nthree");
    assert.equal(applyProposalChanges(deletion, new Set([deletion.changes[0].id])), "one\nthree");
    assert.equal(applyProposalChanges(deletion, new Set()), "one\ntwo\nthree");

    const replacement = createTextProposal("one\ntwo\nthree", "one\nTWO\nthree");
    assert.equal(applyProposalChanges(replacement, new Set([replacement.changes[0].id])), "one\nTWO\nthree");
    assert.equal(createTextProposal("unchanged", "unchanged").changes.length, 0);
});
