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


test("fact corrections preserve Article blank-line formatting", () => {
    const proposal = createTextProposal("first\nold fact\nlast", "first\n\ncorrected fact\n\nlast");
    const removal = createTextProposal("first\n\nold fact\nlast", "first\ncorrected fact\nlast");

    assert.equal(applyProposalChanges(proposal, new Set([proposal.changes[0]!.id]), true), "first\ncorrected fact\nlast");
    assert.equal(applyProposalChanges(removal, new Set(removal.changes.map((change) => change.id)), true), "first\n\ncorrected fact\nlast");
});


// Product scenarios: editorial-workflows.paragraph-change-alignment
test("paragraph count changes stay grouped without shifting later replacements", () => {
    const anchor = "Keep 42, https://example.test and `code` unchanged.";
    const cases = [
        { base: "First old paragraph.\n\nSecond old paragraph.", proposed: "Merged replacement." },
        { base: "Original paragraph.", proposed: "First split paragraph.\n\nSecond split paragraph." },
        { base: "", proposed: "Inserted paragraph." },
        { base: "Deleted paragraph.", proposed: "" },
        { base: "Repeated paragraph.\n\nRepeated paragraph.", proposed: "Repeated paragraph." },
    ];

    for (const fixture of cases) {
        const basePrefix = fixture.base ? `${fixture.base}\n\n` : "";
        const proposedPrefix = fixture.proposed ? `${fixture.proposed}\n\n` : "";
        const base = `${basePrefix}${anchor}\n\nLater original.`;
        const proposed = `${proposedPrefix}${anchor}\n\nLater replacement.`;
        const review = createTextProposal(base, proposed);

        assert.equal(review.changes.length, 2, JSON.stringify(fixture));
        const [first, later] = review.changes;
        assert.deepEqual(later.baseLines, ["Later original."]);
        assert.deepEqual(later.proposalLines, ["Later replacement."]);
        assert.equal(applyProposalChanges(review, new Set([first.id])), `${proposedPrefix}${anchor}\n\nLater original.`);
        assert.equal(applyProposalChanges(review, new Set([later.id])), `${basePrefix}${anchor}\n\nLater replacement.`);
        assert.equal(applyProposalChanges(review, new Set()), base);
        assert.equal(applyProposalChanges(review, new Set(review.changes.map((change) => change.id))), proposed);
    }
});


test("adjacent paragraph replacements form one group until unchanged text anchors them", () => {
    const base = "First paragraph.\n\nSecond paragraph.\n\nLater original.";
    const proposed = "Merged paragraph.\n\nLater replacement.";
    const review = createTextProposal(base, proposed);

    assert.equal(review.changes.length, 1);
    assert.equal(applyProposalChanges(review, new Set([review.changes[0].id])), proposed);
    assert.equal(applyProposalChanges(review, new Set()), base);
    assert.deepEqual(createTextProposal("\nSame.\n \nSame.\n", "\nSame.\n \nSame.\n").changes, []);
});
