import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { message } from "../../i18n/test-message.js";
import { ProposalReviewView } from "./ProposalReviewView.js";

// Product scenarios: workspace.proposal.stale-blocked, editorial-workflows.stale-proposal-blocked

describe("ProposalReviewView", () => {
    afterEach(cleanup);

    it("shows an advisory summary above the corresponding change diff", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale={false} decisions={{}} summaries={{ "change-1": "Clarifies the opening statement." }} summaryState="idle" setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} dismissProposal={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("Clarifies the opening statement.")).toBeTruthy();
        expect(screen.getAllByText("Original").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Proposed").length).toBeGreaterThan(0);
        expect(screen.getByText(message("views.preservationWarnings")).compareDocumentPosition(screen.getByRole("heading", { name: message("views.proposalReview") })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("workspace.proposal.stale-blocked warns before the review controls while blocking acceptance", () => {
        const dismissProposal = vi.fn();

        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original\nSecond original",
                proposedContent: "Proposed\nSecond proposed",
                changes: [
                    { id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] },
                    { id: "change-2", baseStart: 1, baseEnd: 2, baseLines: ["Second original"], proposalLines: ["Second proposed"] },
                ],
            }} stale decisions={{ "change-1": "accepted" }} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} dismissProposal={dismissProposal} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        const warning = screen.getByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.");
        const heading = screen.getByRole("heading", { name: message("views.proposalReview") });

        expect(warning.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText("Complete proposal · 2 changes")).toBeTruthy();
        expect(screen.getByRole("button", { name: message("views.acceptAll") }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: message("views.rejectAll") }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: message("views.reviewCurrentArticle") })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: message("views.dismissProposal") }));
        expect(dismissProposal).toHaveBeenCalledOnce();
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
            }} stale={false} decisions={{}} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} dismissProposal={vi.fn()} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByRole("button", { name: message("views.previousChange") }).querySelector("svg")).toBeTruthy();
        expect(screen.getByRole("button", { name: message("views.nextChange") }).querySelector("svg")).toBeTruthy();
    });

    it("selects every change as rejected without dismissing the Proposal", () => {
        const rejectAll = vi.fn();
        const dismissProposal = vi.fn();

        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original",
                proposedContent: "Proposed",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original"], proposalLines: ["Proposed"] }],
            }} stale={false} decisions={{}} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={rejectAll} dismissProposal={dismissProposal} warningsDismissed={false} dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        fireEvent.click(screen.getByRole("button", { name: message("views.rejectAll") }));

        expect(rejectAll).toHaveBeenCalledOnce();
        expect(dismissProposal).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: message("views.proposalReview") })).toBeTruthy();
    });
});
