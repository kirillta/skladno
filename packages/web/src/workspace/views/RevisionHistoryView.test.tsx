import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type ArticleRevision, type GeneralSettings } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { RevisionHistoryView } from "./RevisionHistoryView.js";


function revision(id: string, content: string, kind: string, createdAt: string, restoredFromRevisionId?: string): ArticleRevision {
    return {
        id,
        articleId: "article-one",
        content,
        createdAt,
        provenance: { kind },
        ...(restoredFromRevisionId ? { restoredFromRevisionId } : {}),
    };
}


function renderHistory(revisions: ArticleRevision[], currentRevisionId = revisions.at(-1)?.id ?? "", generalSettings?: GeneralSettings) {
    const select = vi.fn();
    const result = render(<IntlProvider locale="en" messages={messages}><RevisionHistoryView revisions={revisions} currentRevisionId={currentRevisionId} select={select} generalSettings={generalSettings} /></IntlProvider>);

    return { ...result, select };
}


describe("RevisionHistoryView", () => {
    afterEach(cleanup);


    it("selects the current Revision by default and shows history newest first", () => {
        const initial = revision("initial", "Initial text", "initial", "2026-01-01T10:00:00.000Z");
        const current = revision("current", "Current text", "author-draft", "2026-01-02T10:00:00.000Z");
        const view = renderHistory([initial, current]);
        const buttons = view.container.querySelectorAll("nav button");

        expect(buttons[0]?.textContent).toContain("Author Revision");
        expect(buttons[1]?.textContent).toContain("Initial Revision");
        expect(screen.getByText("Current text")).toBeTruthy();
        expect(screen.getByText("This is the current Revision.")).toBeTruthy();
        expect(screen.getByText("Current Revision")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Restore this revision" })).toBeNull();
        expect((screen.getByRole("combobox", { name: "Select a Revision" }) as HTMLSelectElement).value).toBe("current");
    });


    it("updates only the read-only preview when an earlier Revision is selected and sends it to restore on request", async () => {
        const user = userEvent.setup();
        const initial = revision("initial", "Initial text", "initial", "2026-01-01T10:00:00.000Z");
        const current = revision("current", "Current text", "accepted-proposal", "2026-01-02T10:00:00.000Z");
        const { select } = renderHistory([initial, current]);

        await user.click(screen.getAllByRole("button", { name: /Initial Revision/ })[0]!);

        expect(screen.getByText("Initial text")).toBeTruthy();
        expect((screen.getByRole("button", { name: "Restore this revision" }) as HTMLButtonElement).disabled).toBe(false);
        await user.click(screen.getByRole("button", { name: "Restore this revision" }));
        expect(select).toHaveBeenCalledWith(initial);
    });


    it("uses safe localized provenance labels and a quiet empty-content state", () => {
        const restored = revision("restored", "", "unknown-kind", "2026-01-02T10:00:00.000Z", "initial");
        const unknown = revision("unknown", "Saved text", "legacy-kind", "2026-01-01T10:00:00.000Z");
        renderHistory([unknown, restored], restored.id);

        expect(screen.getAllByText("Restored Revision").length).toBeGreaterThan(0);
        expect(screen.getByText("Restored from an earlier Revision")).toBeTruthy();
        expect(screen.getByText("This Revision has no saved Article text.")).toBeTruthy();
        expect(screen.getByText("Saved Revision")).toBeTruthy();
    });


    it("uses distinct timeline icons for initial, manual, AI-assisted, and restored Revisions", () => {
        const initial = revision("initial", "Initial", "initial", "2026-01-01T10:00:00.000Z");
        const manual = revision("manual", "Manual", "author-draft", "2026-01-02T10:00:00.000Z");
        const ai = revision("ai", "AI", "accepted-proposal", "2026-01-03T10:00:00.000Z");
        const restored = revision("restored", "Restored", "restore", "2026-01-04T10:00:00.000Z", "initial");
        const view = renderHistory([initial, manual, ai, restored], restored.id);

        expect(view.container.querySelector('[data-revision-timeline-icon="initial"]')).toBeTruthy();
        expect(view.container.querySelector('[data-revision-timeline-icon="manual"]')).toBeTruthy();
        expect(view.container.querySelector('[data-revision-timeline-icon="ai"]')).toBeTruthy();
        expect(view.container.querySelector('[data-revision-timeline-icon="restored"]')).toBeTruthy();
    });


    it("uses the saved time format and time zone preference for Revision timestamps", () => {
        const initial = revision("initial", "Initial", "initial", "2026-01-01T15:45:00.000Z");
        renderHistory([initial], initial.id, { ...defaultGeneralSettings, timeFormat: "24-hour", timeZone: "America/New_York" });

        expect(screen.getAllByText(/10:45/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/PM/)).toBeNull();
    });
});
