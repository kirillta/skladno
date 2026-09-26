import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { getMessage } from "../../i18n/test-message.js";
import { FactCheckView as RenderFactCheckView } from "./FactCheckView.js";

type FactCheckViewTestProps = Parameters<typeof RenderFactCheckView>[0]["data"] & Parameters<typeof RenderFactCheckView>[0]["actions"];


function FactCheckView(props: FactCheckViewTestProps) {
    const { factCheck, runs, selectedRun, revisionNumber, reusedRevisionNumbers, stale, historical, runAgain, selectRun, resolve, proposeCorrections } = props;
    return <RenderFactCheckView data={{ factCheck, runs, selectedRun, revisionNumber, reusedRevisionNumbers, stale, historical }} actions={{ runAgain, selectRun, resolve, proposeCorrections }} />;
}


// Product scenarios: history-and-publishing.fact-check-history

const factCheck = { reviewedRevisionId: "revision-1", findings: [{ factId: "fact-1", occurrenceId: "revision-1:fact-1", claim: "A claim that needs evidence.", status: "disputed" as const, rationale: "The source contradicts the stated number.", uncertainty: "Medium", sources: [{ url: "https://example.com/source", title: "Primary source", quality: "primary" as const, publishedAt: "2026-01-01" }] }] };

afterEach(cleanup);

describe("FactCheckView", () => {
    // Product scenario: workspace.findings.incomplete-timeout
    it("labels timed-out findings as incomplete", () => {
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, incomplete: true }} stale={false} runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getByText(getMessage("views.factCheckIncomplete"))).toBeTruthy();
        expect(screen.getAllByText("A claim that needs evidence.")).toHaveLength(2);
        expect(screen.getByRole("button", { name: getMessage("views.runFactCheckAgain") })).toBeTruthy();
    });

    it("shows evidence reuse provenance and the original check time", () => {
        const finding = { ...factCheck.findings[0]!, reusedFromRevisionId: "revision-1", checkedAt: "2026-01-01T12:00:00.000Z" };
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, findings: [finding] }} reusedRevisionNumbers={{ "revision-1": 1 }} stale={false} runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getByText("Evidence reused from Revision v1.")).toBeTruthy();
        expect(screen.getByText(/^Checked /)).toBeTruthy();
        expect(screen.getByRole("link", { name: /Primary source/ }).textContent).toContain("2026-01-01");
    });

    it("keeps stale findings readable but blocks correction selection", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} stale runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getAllByText("A claim that needs evidence.")).toHaveLength(2);
        expect(screen.getByRole("link", { name: /Primary source/ }).getAttribute("title")).toBe("https://example.com/source");
        expect(screen.getByRole("link", { name: /Primary source/ }).getAttribute("target")).toBe("_blank");
        expect(screen.queryByRole("button", { name: /Propose corrections/ })).toBeNull();
        await user.click(screen.getByRole("button", { name: getMessage("views.runFactCheckAgain") }));
    });


    it("keeps earlier findings readable but blocks corrections until a current Fact Check", () => {
        const findings = [
            { ...factCheck.findings[0], stale: true },
            { ...factCheck.findings[0], occurrenceId: "revision-1:fact-2", claim: "An unchanged claim.", stale: false },
            { ...factCheck.findings[0], occurrenceId: "revision-1:fact-3", claim: "A corrected claim.", resolution: "corrected_or_removed" as const, stale: false },
        ];
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, findings }} stale runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.queryByRole("button", { name: getMessage("views.proposeFactCorrection") })).toBeNull();
        expect(screen.getAllByText("An unchanged claim.")).toHaveLength(2);
        expect(screen.getByText("Corrected or removed")).toBeTruthy();
    });


    it("shows the reviewed Revision and actionable current findings", async () => {
        const user = userEvent.setup();
        const runAgain = vi.fn();
        const proposeCorrections = vi.fn();
        const resolve = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} revisionNumber={3} stale={false} runAgain={runAgain} resolve={resolve} proposeCorrections={proposeCorrections} /></IntlProvider>);

        expect(screen.getByText("Reviewed Revision: v3")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: getMessage("views.proposeFactCorrection") }));
        await user.click(screen.getByRole("button", { name: getMessage("views.acceptFactAsWritten") }));
        expect(proposeCorrections).toHaveBeenCalledWith([factCheck.findings[0]]);
        expect(resolve).toHaveBeenCalledWith("revision-1:fact-1", "accepted_as_written");
    });


    it("highlights and scrolls to a selected finding, and localizes its resolution", async () => {
        const user = userEvent.setup();
        const scrollTo = vi.fn();
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, findings: [{ ...factCheck.findings[0], resolution: "accepted_as_written" }] }} stale={false} runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        screen.getAllByRole("button", { name: /A claim that needs evidence/ })[0]!.focus();
        await user.keyboard("{Enter}");
        expect(scrollTo).toHaveBeenCalledOnce();
        expect(screen.getAllByRole("button", { name: /A claim that needs evidence/ })[0]!.getAttribute("aria-current")).toBe("true");
        expect(screen.getByText("Accepted as written")).toBeTruthy();
    });


    it("runs a Fact Check from its empty state", async () => {
        const user = userEvent.setup();
        const runAgain = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={undefined} stale={false} runAgain={runAgain} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: getMessage("views.runFactCheck") }));
        expect(runAgain).toHaveBeenCalledOnce();
    });

    it("offers retained runs when the current Revision has no Fact Check", async () => {
        const user = userEvent.setup();
        const selectRun = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={undefined} runs={[{ ...factCheck, createdAt: "2026-01-02T12:00:00.000Z" }]} reusedRevisionNumbers={{ "revision-1": 1 }} stale={false} runAgain={vi.fn()} selectRun={selectRun} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getByRole("option", { name: "Current Revision" })).toBeTruthy();
        expect(screen.getByRole("option", { name: /Revision v1, checked/ })).toBeTruthy();
        await user.selectOptions(screen.getByRole("combobox", { name: "Fact Check history" }), "0");
        expect(selectRun).toHaveBeenCalledWith(0);
    });

    it("keeps an older run for the current Revision read-only", () => {
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={factCheck} runs={[factCheck, factCheck]} selectedRun={1} stale={false} historical runAgain={vi.fn()} selectRun={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getByText(/earlier Fact Check run is read-only/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: getMessage("views.proposeFactCorrection") })).toBeNull();
        expect(screen.queryByRole("button", { name: getMessage("views.acceptFactAsWritten") })).toBeNull();
    });

    it("distinguishes dated evidence from a stale Revision", () => {
        render(<IntlProvider locale="en" messages={messages}><FactCheckView factCheck={{ ...factCheck, findings: [{ ...factCheck.findings[0]!, checkedAt: "2026-01-02T12:00:00.000Z" }] }} stale={false} runAgain={vi.fn()} resolve={vi.fn()} proposeCorrections={vi.fn()} /></IntlProvider>);

        expect(screen.getByText(/Time-sensitive claims may have changed/)).toBeTruthy();
        expect(screen.queryByText(/earlier Revision/)).toBeNull();
    });
});
