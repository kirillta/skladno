import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { FactCheckView } from "./FactCheckView.js";

// product: history-and-publishing.fact-findings-advisory

const factCheck = { reviewedRevisionId: "revision-1", findings: [{ factId: "fact-1", occurrenceId: "revision-1:fact-1", claim: "A claim that needs evidence.", status: "disputed" as const, rationale: "The source contradicts the stated number.", uncertainty: "Medium", sources: [{ url: "https://example.com/source", title: "Primary source", quality: "primary" as const, publishedAt: "2026-01-01" }] }] };

describe("FactCheckView", () => {
    it("keeps stale findings readable but blocks correction selection", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} stale runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getAllByText("A claim that needs evidence.")).toHaveLength(2);
        expect(screen.getByRole("link", { name: /Primary source/ }).getAttribute("target")).toBe("_blank");
        expect(screen.queryByRole("button", { name: /Propose corrections/ })).toBeNull();
        await user.click(screen.getByRole("button", { name: "Run Fact Check again" }));
    });


    it("shows the reviewed Revision and actionable current findings", async () => {
        const user = userEvent.setup();
        const runAgain = vi.fn();
        const proposeCorrections = vi.fn();
        const resolve = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} revisionNumber={3} stale={false} runAgain={runAgain} resolve={resolve} proposeCorrections={proposeCorrections} /></IntlProvider>);

        expect(screen.getByText("Reviewed Revision: v3")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Propose correction" }));
        await user.click(screen.getByRole("button", { name: "Accept as written" }));
        expect(proposeCorrections).toHaveBeenCalledWith([factCheck.findings[0]]);
        expect(resolve).toHaveBeenCalledWith("revision-1:fact-1", "accepted_as_written");
    });


    it("highlights and scrolls to a selected finding, and localizes its resolution", async () => {
        const user = userEvent.setup();
        const scrollTo = vi.fn();
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, findings: [{ ...factCheck.findings[0], resolution: "accepted_as_written" }] }} stale={false} runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        await user.click(screen.getAllByRole("button", { name: /A claim that needs evidence/ })[0]!);
        expect(scrollTo).toHaveBeenCalledOnce();
        expect(screen.getAllByRole("button", { name: /A claim that needs evidence/ })[0]!.getAttribute("aria-current")).toBe("true");
        expect(screen.getByText("Accepted as written")).toBeTruthy();
    });


    it("runs a Fact Check from its empty state", async () => {
        const user = userEvent.setup();
        const runAgain = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={undefined} stale={false} runAgain={runAgain} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Run Fact Check" }));
        expect(runAgain).toHaveBeenCalledOnce();
    });
});
