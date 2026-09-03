import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: cross-cutting.accessible-workspace-separators

describe("Editorial Workspace layout", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("keeps the Article Workspace first while resizing panels with accessible separators", async () => {
        localStorage.clear();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 1,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
        }));
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);

        await screen.findByRole("heading", { name: "First Article" });

        const libraryResize = screen.getByRole("separator", { name: message("navigation.resizeArticleLibrary") });
        const assistantResize = screen.getByRole("separator", { name: message("assistant.resize") });
        const main = libraryResize.closest("main")!;

        expect(main.firstElementChild?.tagName).toBe("SECTION");

        expect(libraryResize.getAttribute("aria-valuemin")).toBe("192");
        expect(libraryResize.getAttribute("aria-valuemax")).toBe("280");
        await user.click(libraryResize);
        await user.keyboard("{ArrowRight}");
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("224");

        fireEvent.keyDown(libraryResize, { key: "End" });
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("280");
        fireEvent.keyDown(libraryResize, { key: "Home" });
        fireEvent.pointerDown(libraryResize, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(window, { clientX: 132, pointerId: 1 });
        fireEvent.pointerUp(window, { pointerId: 1 });
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("224");
        fireEvent.keyDown(assistantResize, { key: "Home" });
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("320");
        fireEvent.pointerDown(assistantResize, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(window, { clientX: 68, pointerId: 1 });
        fireEvent.pointerUp(window, { pointerId: 1 });
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("352");
        fireEvent.keyDown(assistantResize, { key: "End" });
        expect(assistantResize.getAttribute("aria-valuemax")).toBe("576");
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("576");
        expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toMatchObject({ libraryWidth: 224, assistantWidth: 576 });
    });
});
