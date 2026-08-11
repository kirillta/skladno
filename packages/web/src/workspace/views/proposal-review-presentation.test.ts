import { describe, expect, it } from "vitest";
import { createTextProposal } from "@skladno/shared";
import { presentProposalReview } from "./proposal-review-presentation.js";


describe("presentProposalReview", () => {
    it("classifies changes and identifies preservation details", () => {
        const presentation = presentProposalReview(createTextProposal("old", "new 42 https://example.test `code`"));

        expect(presentation.reliable).toBe(true);
        expect(presentation.changes[0]?.kind).toBe("replacement");
        expect(presentation.warnings).toEqual(["url", "number", "code", "claims"]);
    });
});
