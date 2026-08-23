import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { message } from "../../i18n/test-message.js";
import { workspaceViews } from "../workspace-views.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";

// Product scenario: workspace.navigation.keyboard-tabs

describe("WorkspaceTabBar", () => {
    afterEach(cleanup);

    it("exposes badge conditions in tab names without changing tab semantics", async () => {
        const setView = vi.fn();
        const user = userEvent.setup();

        render(<IntlProvider locale="en" messages={messages}>
            <WorkspaceTabBar view="write" setView={setView} badges={{
                proposal: { label: "Review", accessibleLabel: "Review", tone: "default" },
                "fact-check": { label: "2", accessibleLabel: "2 findings", tone: "default" },
                translations: { label: "Stale", accessibleLabel: "Stale", tone: "warning" },
            }} />
        </IntlProvider>);

        const write = screen.getByRole("tab", { name: message("workspace.tabs.write") });
        const proposal = screen.getByRole("tab", { name: `${message("workspace.tabs.proposal")}: Review` });
        const factCheck = screen.getByRole("tab", { name: `${message("workspace.tabs.factCheck")}: 2 findings` });
        const translations = screen.getByRole("tab", { name: `${message("workspace.tabs.translations")}: Stale` });

        expect(write.getAttribute("aria-selected")).toBe("true");
        expect(proposal.getAttribute("aria-controls")).toBe("workspace-panel-proposal");
        expect(proposal.textContent).toContain("Review");
        expect(factCheck.textContent).toContain("2");
        expect(translations.textContent).toContain("Stale");
        expect(screen.getByRole("tab", { name: message("workspace.tabs.revisions") }).textContent).toBe(message("workspace.tabs.revisions"));

        write.focus();
        await user.keyboard("{End}");

        expect(setView).toHaveBeenCalledWith("translations");
        expect(document.activeElement).toBe(translations);
    });


    it("keeps stable tab-panel relationships and roving keyboard selection for every Workspace View", async () => {
        const setView = vi.fn();
        const user = userEvent.setup();

        render(<IntlProvider locale="en" messages={messages}>
            <WorkspaceTabBar view="fact-check" setView={setView} badges={{
                proposal: { label: "Stale", accessibleLabel: "Stale", tone: "warning" },
                "fact-check": { label: "1", accessibleLabel: "1 finding", tone: "default" },
                "style-profile": { label: "0 findings", accessibleLabel: "0 findings", tone: "default" },
                translations: { label: "Ready", accessibleLabel: "Ready", tone: "default" },
            }} />
        </IntlProvider>);

        const tabs = screen.getAllByRole("tab");
        const expectedViews = workspaceViews;

        expect(tabs).toHaveLength(expectedViews.length);
        for (const [index, id] of expectedViews.entries()) {
            expect(tabs[index]!.id).toBe(`workspace-tab-${id}`);
            expect(tabs[index]!.getAttribute("aria-controls")).toBe(`workspace-panel-${id}`);
            expect(tabs[index]!.getAttribute("aria-selected")).toBe(index === 3 ? "true" : "false");
            expect(tabs[index]!.getAttribute("tabindex")).toBe(index === 3 ? "0" : "-1");
        }

        const factCheck = screen.getByRole("tab", { name: `${message("workspace.tabs.factCheck")}: 1 finding` });
        factCheck.focus();
        await user.keyboard("{ArrowRight}");
        expect(setView).toHaveBeenLastCalledWith("style-profile");
        expect(document.activeElement).toBe(screen.getByRole("tab", { name: `${message("workspace.tabs.styleProfile")}: 0 findings` }));
        await user.keyboard("{ArrowLeft}");
        expect(setView).toHaveBeenLastCalledWith("fact-check");
        await user.keyboard("{Home}");
        expect(setView).toHaveBeenLastCalledWith("write");
        await user.keyboard("{End}");
        expect(setView).toHaveBeenLastCalledWith("translations");

        expect(screen.getByRole("tab", { name: message("workspace.tabs.revisions") }).textContent).toBe(message("workspace.tabs.revisions"));
        expect(screen.getByRole("tab", { name: `${message("workspace.tabs.proposal")}: Stale` }).textContent).toContain("Stale");
        expect(screen.getByRole("tab", { name: `${message("workspace.tabs.translations")}: Ready` }).textContent).toContain("Ready");
    });
});
