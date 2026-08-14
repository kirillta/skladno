import { describe, expect, it } from "vitest";
import type { FactCheck } from "@skladno/shared";
import { withFindingFreshness } from "./editorial-proposal-state.js";

const check: FactCheck = { reviewedRevisionId: "revision-1", findings: [
    { claim: "Unchanged fact.", status: "disputed", rationale: "", uncertainty: "", sources: [] },
    { claim: "Removed statement.", status: "disputed", rationale: "", uncertainty: "", sources: [] },
    { claim: "Accepted fact.", status: "disputed", rationale: "", uncertainty: "", sources: [], resolution: "accepted_as_written" },
] };

describe("finding freshness", () => {
    it("keeps unchanged and accepted findings across a Revision update", () => {
        expect(withFindingFreshness(check, "revision-2", "Unchanged fact.").findings.map((finding) => finding.stale)).toEqual([false, true, false]);
    });
});
