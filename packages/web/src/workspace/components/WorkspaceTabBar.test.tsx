import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";


describe("WorkspaceTabBar", () => {
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
});
