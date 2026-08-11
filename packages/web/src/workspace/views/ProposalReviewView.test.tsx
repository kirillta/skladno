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
            }} stale={false} decisions={{}} summaries={{ "change-1": "Clarifies the opening statement." }} summaryState="idle" setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("Clarifies the opening statement.")).toBeTruthy();
        expect(screen.getAllByText("Original").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Proposed").length).toBeGreaterThan(0);
        expect(screen.getByText("Check preserved details").compareDocumentPosition(screen.getByRole("heading", { name: "Proposal Review" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("workspace.proposal.stale-blocked warns before the review controls while blocking acceptance", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale decisions={{ "change-1": "accepted" }} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        const warning = screen.getByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.");
        const heading = screen.getByRole("heading", { name: "Proposal Review" });

        expect(warning.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole("button", { name: "Accept all" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "Reject all" }).hasAttribute("disabled")).toBe(false);
    });

    it("uses labelled chevron buttons to navigate between changes", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original\nSecond original",
                proposedContent: "Proposed\nSecond proposed",
                changes: [
                    { id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] },
                    { id: "change-2", baseStart: 1, baseEnd: 2, baseLines: ["Second original"], proposalLines: ["Second proposed"] },
                ],
            }} stale={false} decisions={{}} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByRole("button", { name: "Previous change" }).querySelector("svg")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Next change" }).querySelector("svg")).toBeTruthy();
    });
});
