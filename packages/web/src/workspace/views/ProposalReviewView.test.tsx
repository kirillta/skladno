import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { getMessage } from "../../i18n/test-message.js";
import { ProposalReviewView as RenderProposalReviewView } from "./ProposalReviewView.js";

type ProposalReviewViewTestProps = Parameters<typeof RenderProposalReviewView>[0]["data"] & Parameters<typeof RenderProposalReviewView>[0]["actions"];


function ProposalReviewView(props: ProposalReviewViewTestProps) {
    const { review, accepted, stale, decisions, summaries, summaryState, warningsDismissed, setDecision, acceptAll, applyAccepted, rejectAll, dismissProposal, dismissWarnings, openWrite, openAssistant } = props;
    return <RenderProposalReviewView data={{ review, accepted, stale, decisions, summaries, summaryState, warningsDismissed }} actions={{ setDecision, acceptAll, applyAccepted, rejectAll, dismissProposal, dismissWarnings, openWrite, openAssistant }} />;
}


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
        expect(screen.getByText(getMessage("views.preservationWarnings")).closest(".overflow-y-auto")).toBeTruthy();
    });

    it("workspace.proposal.stale-blocked shows recovery actions in the header instead of acceptance", () => {
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
        const header = screen.getByRole("heading", { name: getMessage("views.proposalReview") }).closest("header");

        expect(header?.contains(warning)).toBe(true);
        expect(warning.parentElement?.lastElementChild).toBe(warning);
        expect(warning.previousElementSibling?.contains(screen.getByRole("button", { name: getMessage("views.dismissProposal") }))).toBe(true);
        expect(screen.getByText("Complete proposal · 2 changes")).toBeTruthy();
        expect(screen.queryByRole("button", { name: getMessage("views.acceptAll") })).toBeNull();
        expect(screen.queryByRole("button", { name: getMessage("views.rejectAll") })).toBeNull();
        expect(header?.contains(screen.getByRole("button", { name: getMessage("views.reviewCurrentArticle") }))).toBe(true);
        expect(header?.contains(screen.getByRole("button", { name: getMessage("views.regenerateInAssistant") }))).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: getMessage("views.dismissProposal") }));
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

        expect(screen.getByRole("button", { name: getMessage("views.previousChange") }).querySelector("svg")).toBeTruthy();
        expect(screen.getByRole("button", { name: getMessage("views.nextChange") }).querySelector("svg")).toBeTruthy();
    });

    it("scrolls the selected change to the start of the review", () => {
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = scrollIntoView;

        try {
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

            const nextChange = screen.getByRole("button", { name: getMessage("views.nextChange") });
            fireEvent.click(nextChange);
            nextChange.focus();
            fireEvent.click(nextChange);

            expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
            expect(scrollIntoView.mock.contexts[0]).toBe(screen.getAllByRole("article")[0]);
            expect(scrollIntoView.mock.contexts[1]).toBe(screen.getAllByRole("article")[1]);
        } finally {
            HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it("keeps change navigation outside the scrolling review content", () => {
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

        const header = screen.getByRole("heading", { name: getMessage("views.proposalReview") }).closest("header");
        const content = header?.nextElementSibling;

        expect(header).toBeTruthy();
        expect(content?.className).toContain("overflow-y-auto");
        expect(content?.contains(screen.getByRole("button", { name: getMessage("views.nextChange") }))).toBe(false);
    });

    it("applies exact-text highlights to both layouts", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <ProposalReviewView review={{
                baseContent: "Original sentence.",
                proposedContent: "Improved sentence.",
                changes: [{ id: "change-1", baseStart: 0, baseEnd: 1, baseLines: ["Original sentence."], proposalLines: ["Improved sentence."] }],
            }} stale={false} decisions={{}} setDecision={vi.fn()} acceptAll={vi.fn()} applyAccepted={vi.fn()} rejectAll={vi.fn()} dismissProposal={vi.fn()} warningsDismissed dismissWarnings={vi.fn()} openWrite={vi.fn()} openAssistant={vi.fn()} />
        </IntlProvider>);

        const sideBySide = screen.getByRole("button", { name: getMessage("views.proposalSideBySide") });
        const stacked = screen.getByRole("button", { name: getMessage("views.proposalStacked") });
        const highlight = screen.getByRole("button", { name: getMessage("views.proposalHighlight") });
        expect(sideBySide.getAttribute("aria-pressed")).toBe("true");

        fireEvent.click(stacked);
        expect(stacked.getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByLabelText(getMessage("ui.proposedChange")).className).toContain("bg-canvas");
        expect(screen.getByText(getMessage("ui.original"))).toBeTruthy();
        expect(screen.getByText(getMessage("ui.proposed"))).toBeTruthy();

        fireEvent.click(highlight);

        expect(highlight.getAttribute("aria-pressed")).toBe("true");
        expect(stacked.getAttribute("aria-pressed")).toBe("true");
        expect(screen.getAllByText("Original").some((element) => element.tagName === "MARK")).toBe(true);
        expect(screen.getByText("Improved").tagName).toBe("MARK");

        fireEvent.click(sideBySide);
        expect(sideBySide.getAttribute("aria-pressed")).toBe("true");
        expect(highlight.getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText("Improved").tagName).toBe("MARK");
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

        fireEvent.click(screen.getByRole("button", { name: getMessage("views.rejectAll") }));

        expect(rejectAll).toHaveBeenCalledOnce();
        expect(dismissProposal).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: getMessage("views.proposalReview") })).toBeTruthy();
    });
});
