import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { settingsFocusAreas, useFocusAreaNavigation } from "./focus-area-navigation.js";


function SettingsFocusAreas() {
    const focusAreas = useFocusAreaNavigation(settingsFocusAreas);
    return <main ref={focusAreas.ref} onFocusCapture={focusAreas.onFocusCapture} onKeyDownCapture={focusAreas.onKeyDownCapture}>
        <aside data-focus-area="settings-navigation"><button data-focus-area-entry>Navigation</button></aside>
        <section data-focus-area="settings-content"><button>First control</button><button data-focus-area-entry>Content</button><button>Second control</button></section>
    </main>;
}


it("traverses Settings navigation and content as separate areas", () => {
    render(<SettingsFocusAreas />);
    const navigation = screen.getByRole("button", { name: "Navigation" });
    navigation.focus();

    fireEvent.keyDown(navigation, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Content" }));
    const secondControl = screen.getByRole("button", { name: "Second control" });
    secondControl.focus();
    fireEvent.keyDown(secondControl, { key: "Tab" });
    expect(document.activeElement).toBe(navigation);
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Content" }));
});


it("enters a content-editable Writing Surface", () => {
    function WritingSurface() {
        const focusAreas = useFocusAreaNavigation(["toolbar", "article-editor"]);
        return <main ref={focusAreas.ref} onFocusCapture={focusAreas.onFocusCapture} onKeyDownCapture={focusAreas.onKeyDownCapture}>
            <div data-focus-area="toolbar"><button data-focus-area-entry>Toolbar</button></div>
            <div data-focus-area="article-editor"><div data-focus-area-entry contentEditable aria-label="Writing Surface" /></div>
        </main>;
    }


    render(<WritingSurface />);
    const toolbar = screen.getByRole("button", { name: "Toolbar" });
    toolbar.focus();

    fireEvent.keyDown(toolbar, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByLabelText("Writing Surface"));
});
