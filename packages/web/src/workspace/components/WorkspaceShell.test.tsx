import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { getMessage } from "../../i18n/test-message.js";
import { WorkspaceShell as RenderWorkspaceShell } from "./WorkspaceShell.js";

// Product scenarios: workspace.shell.responsive-collapse, workspace.shell.focus-mode

const originalViewportWidth = window.innerWidth;


function WorkspaceShell({ children, library, assistant, focusMode, libraryCollapsed, setLibraryCollapsed, assistantCollapsed, setAssistantCollapsed, assistantOpenRequest, libraryWidth, setLibraryWidth, assistantWidth, setAssistantWidth }: {
    children: ReactNode;
    library: ReactNode;
    assistant: ReactNode;
    focusMode: boolean;
    libraryCollapsed: boolean;
    setLibraryCollapsed: (collapsed: boolean) => void;
    assistantCollapsed: boolean;
    setAssistantCollapsed: (collapsed: boolean) => void;
    assistantOpenRequest: number;
    libraryWidth: number;
    setLibraryWidth: (width: number) => void;
    assistantWidth: number;
    setAssistantWidth: (width: number) => void;
}) {
    return <RenderWorkspaceShell content={{ children, library, assistant }} layout={{ focusMode, libraryCollapsed, setLibraryCollapsed, assistantCollapsed, setAssistantCollapsed, assistantOpenRequest, libraryWidth, setLibraryWidth, assistantWidth, setAssistantWidth }} />;
}


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
        assistantOpenRequest: 0,
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


function InteractiveAssistant({ layout }: { layout?: { collapsed: boolean; setCollapsed: (collapsed: boolean) => void } }) {
    return <aside aria-label="Editorial Assistant Panel">
        {layout?.collapsed
            ? <button onClick={() => layout.setCollapsed(false)}>Expand Assistant</button>
            : <button onClick={() => layout?.setCollapsed(true)}>Collapse Assistant</button>}
    </aside>;
}


function ResponsiveShell() {
    const [assistantCollapsed, setAssistantCollapsed] = useState(false);
    const [assistantOpenRequest, setAssistantOpenRequest] = useState(0);


    function updateAssistantCollapsed(collapsed: boolean) {
        setAssistantCollapsed(collapsed);
        if (!collapsed)
            setAssistantOpenRequest((current) => current + 1);
    }


    return <IntlProvider locale="en" messages={messages}>
        <WorkspaceShell
            focusMode={false}
            libraryCollapsed={false}
            setLibraryCollapsed={vi.fn()}
            assistantCollapsed={assistantCollapsed}
            setAssistantCollapsed={updateAssistantCollapsed}
            assistantOpenRequest={assistantOpenRequest}
            libraryWidth={280}
            setLibraryWidth={vi.fn()}
            assistantWidth={384}
            setAssistantWidth={vi.fn()}
            library={<aside aria-label="Article Library Panel">Library</aside>}
            assistant={<InteractiveAssistant />}>
            <div data-article-workspace tabIndex={-1}>Article Workspace</div>
        </WorkspaceShell>
    </IntlProvider>;
}


function FocusAreaShell({ hiddenEditor = false }: { hiddenEditor?: boolean }) {
    return <IntlProvider locale="en" messages={messages}>
        <WorkspaceShell
            focusMode={false}
            libraryCollapsed={false}
            setLibraryCollapsed={vi.fn()}
            assistantCollapsed={false}
            setAssistantCollapsed={vi.fn()}
            assistantOpenRequest={0}
            libraryWidth={208}
            setLibraryWidth={vi.fn()}
            assistantWidth={384}
            setAssistantWidth={vi.fn()}
            library={<aside data-focus-area="library"><button data-focus-area-entry>Library</button></aside>}
            assistant={<aside><button data-focus-area="assistant-chat" data-focus-area-entry>Chat</button><div data-focus-area="assistant-composer"><button data-focus-area-entry>Composer</button></div></aside>}>
            <div>
                <div data-focus-area="workspace-views"><button data-focus-area-entry>Views</button></div>
                <div data-focus-area="article-header"><button data-focus-area-entry>Header</button><button>Last header control</button></div>
                <div data-focus-area="formatting-toolbar"><button data-focus-area-entry>Toolbar</button></div>
                <div data-focus-area="article-editor" hidden={hiddenEditor}><button data-focus-area-entry>Editor</button></div>
                <div data-focus-area="article-status"><button data-focus-area-entry>Status</button></div>
            </div>
        </WorkspaceShell>
    </IntlProvider>;
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
        const libraryResize = screen.getByRole("separator", { name: getMessage("navigation.resizeArticleLibrary") });
        const assistantResize = screen.getByRole("separator", { name: getMessage("assistant.resize") });

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

        expect(screen.getByRole("separator", { name: getMessage("assistant.resize") })).toBeTruthy();

        setViewportWidth(1280);
        expect(screen.queryByRole("separator", { name: getMessage("assistant.resize") })).toBeNull();
        expect(screen.getByLabelText("Editorial Assistant Panel").textContent).toContain("Assistant");
        expect(screen.getByRole("separator", { name: getMessage("navigation.resizeArticleLibrary") })).toBeTruthy();

        setViewportWidth(1440);
        expect(screen.getByRole("separator", { name: getMessage("assistant.resize") })).toBeTruthy();
        view.unmount();
    });


    it("expands a responsively collapsed Assistant Panel when the author requests it", () => {
        setViewportWidth(1280);
        render(<ResponsiveShell />);

        fireEvent.click(screen.getByRole("button", { name: "Expand Assistant" }));

        expect(screen.getByRole("button", { name: "Collapse Assistant" })).toBeTruthy();
        const assistantResize = screen.getByRole("separator", { name: getMessage("assistant.resize") });
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("360");
        expect(assistantResize.getAttribute("aria-valuemax")).toBe("360");

        setViewportWidth(800);
        expect(screen.getByRole("button", { name: "Collapse Assistant" })).toBeTruthy();
        const overlay = screen.getByLabelText("Editorial Assistant Panel").parentElement;
        expect(overlay?.dataset.responsiveOverlay).toBe("true");
        expect(overlay?.className).toContain("border-border-strong");
        expect(screen.queryByRole("separator", { name: getMessage("assistant.resize") })).toBeNull();
    });


    it("collapses the Article Library only once the Assistant is already collapsed", () => {
        setViewportWidth(900);
        renderShell({
            libraryWidth: 280,
            assistantWidth: 384,
        });

        expect(screen.queryByRole("separator", { name: getMessage("assistant.resize") })).toBeNull();
        expect(screen.queryByRole("separator", { name: getMessage("navigation.resizeArticleLibrary") })).toBeNull();
        expect(screen.getByLabelText("Article Library Panel").textContent).toContain("Library");
    });


    it("removes both supporting panels in focus mode", () => {
        setViewportWidth(1280);
        renderShell({ focusMode: true });

        expect(screen.queryByLabelText("Article Library Panel")).toBeNull();
        expect(screen.queryByLabelText("Editorial Assistant Panel")).toBeNull();
        expect(screen.getByText("Article Workspace").closest("section")).toBeTruthy();
    });


    it("moves between focus areas, skips hidden areas, and prefers the declared entry", () => {
        setViewportWidth(1440);
        render(<FocusAreaShell hiddenEditor />);

        const library = screen.getByRole("button", { name: "Library" });
        const header = screen.getByRole("button", { name: "Header" });
        const lastHeaderControl = screen.getByRole("button", { name: "Last header control" });
        library.focus();

        fireEvent.keyDown(library, { key: "Tab" });
        expect(document.activeElement).toBe(header);
        fireEvent.keyDown(document.activeElement!, { key: "Tab" });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Views" }));

        lastHeaderControl.focus();
        fireEvent.keyDown(lastHeaderControl, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(library);
        library.focus();
        fireEvent.keyDown(library, { key: "Tab" });
        expect(document.activeElement).toBe(header);

        fireEvent.keyDown(lastHeaderControl, { key: "Tab" });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Views" }));
        fireEvent.keyDown(document.activeElement!, { key: "Tab" });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Toolbar" }));
        fireEvent.keyDown(document.activeElement!, { key: "Tab" });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Status" }));
    });


    it("wraps from the editor through status, Assistant, Library, and views", () => {
        setViewportWidth(1440);
        render(<FocusAreaShell />);

        const editor = screen.getByRole("button", { name: "Editor" });
        editor.focus();
        for (const name of ["Status", "Chat", "Composer"]) {
            fireEvent.keyDown(document.activeElement!, { key: "Tab" });
            expect(document.activeElement).toBe(screen.getByRole("button", { name }));
        }

        for (const name of ["Library", "Header", "Views"]) {
            fireEvent.keyDown(document.activeElement!, { key: "Tab" });
            expect(document.activeElement).toBe(screen.getByRole("button", { name }));
        }
    });

});
