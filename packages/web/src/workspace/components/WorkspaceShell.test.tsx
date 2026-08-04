import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { WorkspaceShell } from "./WorkspaceShell.js";

// Product scenarios: workspace.shell.responsive-collapse, workspace.shell.focus-mode

const originalViewportWidth = window.innerWidth;

function setViewportWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
        writable: true,
    });
    fireEvent(window, new Event("resize"));
}


function renderShell(props: Partial<Parameters<typeof WorkspaceShell>[0]> = {}) {
    const defaults = {
        focusMode: false,
        libraryCollapsed: false,
        setLibraryCollapsed: vi.fn(),
        assistantCollapsed: false,
        setAssistantCollapsed: vi.fn(),
        libraryWidth: 208,
        setLibraryWidth: vi.fn(),
        assistantWidth: 384,
        setAssistantWidth: vi.fn(),
    };

    return render(<IntlProvider locale="en" messages={messages}>
        <WorkspaceShell {...defaults} {...props}
            library={<aside aria-label="Article Library Panel">Library</aside>}
            assistant={<aside aria-label="Editorial Assistant Panel">Assistant</aside>}>
            <div data-article-workspace tabIndex={-1}>Article Workspace</div>
        </WorkspaceShell>
    </IntlProvider>);
}


describe("WorkspaceShell", () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
        setViewportWidth(originalViewportWidth);
    });


    it("keeps the Article Workspace first with both supporting panels and accessible resize controls at 1440px", () => {
        setViewportWidth(1440);
        renderShell();

        const main = screen.getByRole("main");
        const libraryResize = screen.getByRole("separator", { name: "Resize Article Library Panel" });
        const assistantResize = screen.getByRole("separator", { name: "Resize Editorial Assistant Panel" });

        expect(main.firstElementChild?.textContent).toContain("Article Workspace");
        expect(screen.getByLabelText("Article Library Panel")).toBeTruthy();
        expect(screen.getByLabelText("Editorial Assistant Panel")).toBeTruthy();
        expect(main.getAttribute("style")).toContain("minmax(0, 1fr)");
        expect(libraryResize.getAttribute("aria-orientation")).toBe("vertical");
        expect(libraryResize.getAttribute("aria-valuemin")).toBe("192");
        expect(libraryResize.getAttribute("aria-valuemax")).toBe("280");
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("208");
        expect(assistantResize.getAttribute("aria-orientation")).toBe("vertical");
        expect(assistantResize.getAttribute("aria-valuemin")).toBe("320");
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("384");
    });


    it("temporarily collapses the Assistant Panel before the Article Library and restores the requested layout", () => {
        setViewportWidth(1440);
        const view = renderShell({
            libraryWidth: 280,
            assistantWidth: 384,
        });

        expect(screen.getByRole("separator", { name: "Resize Editorial Assistant Panel" })).toBeTruthy();

        setViewportWidth(1280);
        expect(screen.queryByRole("separator", { name: "Resize Editorial Assistant Panel" })).toBeNull();
        expect(screen.getByLabelText("Editorial Assistant Panel").textContent).toContain("Assistant");
        expect(screen.getByRole("separator", { name: "Resize Article Library Panel" })).toBeTruthy();

        setViewportWidth(1440);
        expect(screen.getByRole("separator", { name: "Resize Editorial Assistant Panel" })).toBeTruthy();
        view.unmount();
    });


    it("collapses the Article Library only once the Assistant is already collapsed", () => {
        setViewportWidth(900);
        renderShell({
            libraryWidth: 280,
            assistantWidth: 384,
        });

        expect(screen.queryByRole("separator", { name: "Resize Editorial Assistant Panel" })).toBeNull();
        expect(screen.queryByRole("separator", { name: "Resize Article Library Panel" })).toBeNull();
        expect(screen.getByLabelText("Article Library Panel").textContent).toContain("Library");
    });


    it("removes both supporting panels in focus mode", () => {
        setViewportWidth(1280);
        renderShell({ focusMode: true });

        expect(screen.queryByLabelText("Article Library Panel")).toBeNull();
        expect(screen.queryByLabelText("Editorial Assistant Panel")).toBeNull();
        expect(screen.getByText("Article Workspace").closest("section")).toBeTruthy();
    });
});
