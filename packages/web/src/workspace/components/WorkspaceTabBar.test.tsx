import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";


describe("WorkspaceTabBar", () => {
    afterEach(cleanup);

    it("exposes badge conditions in tab names without changing tab semantics", async () => {
        const setView = vi.fn();
        const user = userEvent.setup();

        render(<IntlProvider locale="en" messages={messages}>
            <WorkspaceTabBar view="write" setView={setView} badges={{
                proposal: { label: "Review", accessibleLabel: "Review", tone: "default" },
                "fact-check": { label: "2 findings", accessibleLabel: "2 findings", tone: "default" },
                translations: { label: "Stale", accessibleLabel: "Stale", tone: "warning" },
                publish: { label: "Over limit", accessibleLabel: "Over limit", tone: "error" },
            }} />
        </IntlProvider>);

        const write = screen.getByRole("tab", { name: "Write" });
        const proposal = screen.getByRole("tab", { name: "Proposal Review: Review" });
        const factCheck = screen.getByRole("tab", { name: "Fact Check: 2 findings" });
        const translations = screen.getByRole("tab", { name: "Translations: Stale" });
        const publish = screen.getByRole("tab", { name: "Publish: Over limit" });

        expect(write.getAttribute("aria-selected")).toBe("true");
        expect(proposal.getAttribute("aria-controls")).toBe("workspace-panel-proposal");
        expect(factCheck.textContent).toContain("2 findings");
        expect(translations.textContent).toContain("Stale");
        expect(publish.textContent).toContain("Over limit");
        expect(screen.getByRole("tab", { name: "Revisions" }).textContent).toBe("Revisions");

        write.focus();
        await user.keyboard("{End}");

        expect(setView).toHaveBeenCalledWith("publish");
        expect(document.activeElement).toBe(publish);
    });


    it("keeps stable tab-panel relationships and roving keyboard selection for every Workspace View", async () => {
        const setView = vi.fn();
        const user = userEvent.setup();

        render(<IntlProvider locale="en" messages={messages}>
            <WorkspaceTabBar view="fact-check" setView={setView} badges={{
                proposal: { label: "Stale", accessibleLabel: "Stale", tone: "warning" },
                "fact-check": { label: "1 finding", accessibleLabel: "1 finding", tone: "default" },
                "style-profile": { label: "0 findings", accessibleLabel: "0 findings", tone: "default" },
                translations: { label: "Ready", accessibleLabel: "Ready", tone: "default" },
                publish: { label: "Near limit", accessibleLabel: "Near limit", tone: "warning" },
            }} />
        </IntlProvider>);

        const tabs = screen.getAllByRole("tab");
        const expectedViews = ["write", "proposal", "revisions", "fact-check", "style-profile", "translations", "publish"];

        expect(tabs).toHaveLength(expectedViews.length);
        for (const [index, id] of expectedViews.entries()) {
            expect(tabs[index]!.id).toBe(`workspace-tab-${id}`);
            expect(tabs[index]!.getAttribute("aria-controls")).toBe(`workspace-panel-${id}`);
            expect(tabs[index]!.getAttribute("aria-selected")).toBe(index === 3 ? "true" : "false");
            expect(tabs[index]!.getAttribute("tabindex")).toBe(index === 3 ? "0" : "-1");
        }

        const factCheck = screen.getByRole("tab", { name: "Fact Check: 1 finding" });
        factCheck.focus();
        await user.keyboard("{ArrowRight}");
        expect(setView).toHaveBeenLastCalledWith("style-profile");
        expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Style Profile: 0 findings" }));
        await user.keyboard("{ArrowLeft}");
        expect(setView).toHaveBeenLastCalledWith("fact-check");
        await user.keyboard("{Home}");
        expect(setView).toHaveBeenLastCalledWith("write");
        await user.keyboard("{End}");
        expect(setView).toHaveBeenLastCalledWith("publish");

        expect(screen.getByRole("tab", { name: "Revisions" }).textContent).toBe("Revisions");
        expect(screen.getByRole("tab", { name: "Proposal Review: Stale" }).textContent).toContain("Stale");
        expect(screen.getByRole("tab", { name: "Translations: Ready" }).textContent).toContain("Ready");
        expect(screen.getByRole("tab", { name: "Publish: Near limit" }).textContent).toContain("Near limit");
    });
});
