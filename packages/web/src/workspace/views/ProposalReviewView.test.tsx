import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { ProposalReviewView } from "./ProposalReviewView.js";

// product: editorial-workflows.stale-proposal-blocked

describe("ProposalReviewView", () => {
    it("workspace.proposal.stale-blocked keeps a stale Proposal reviewable while blocking acceptance", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale selectedChanges={new Set(["change-1"])} setSelectedChanges={vi.fn()} accept={vi.fn()} reject={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Accept selected changes" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "Reject proposal" }).hasAttribute("disabled")).toBe(false);
    });
});
