import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { ProposalReviewView } from "./ProposalReviewView.js";

// product: editorial-workflows.stale-proposal-blocked

describe("ProposalReviewView", () => {
    afterEach(cleanup);

    it("shows an advisory summary above the corresponding change diff", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale={false} decisions={{}} summaries={{ "change-1": "Clarifies the opening statement." }} summaryState="idle" setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} warningsDismissed dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("Clarifies the opening statement.")).toBeTruthy();
        expect(screen.getAllByText("Original").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Proposed").length).toBeGreaterThan(0);
    });

    it("workspace.proposal.stale-blocked keeps a stale Proposal reviewable while blocking acceptance", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale decisions={{ "change-1": "accepted" }} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Accept all" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "Reject all" }).hasAttribute("disabled")).toBe(false);
    });
});
