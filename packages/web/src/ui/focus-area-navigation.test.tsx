import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { settingsFocusAreas, useFocusAreaNavigation } from "./focus-area-navigation.js";


function SettingsFocusAreas() {
    const focusAreas = useFocusAreaNavigation(settingsFocusAreas);
    return <main ref={focusAreas.ref} onFocusCapture={focusAreas.onFocusCapture} onKeyDownCapture={focusAreas.onKeyDownCapture}>
        <aside data-focus-area="settings-navigation"><button data-focus-area-entry>Navigation</button></aside>
        <section data-focus-area="settings-content"><button data-focus-area-entry>Content</button></section>
    </main>;
}


it("traverses Settings navigation and content as separate areas", () => {
    render(<SettingsFocusAreas />);
    const navigation = screen.getByRole("button", { name: "Navigation" });
    navigation.focus();

    fireEvent.keyDown(navigation, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Content" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(navigation);
});
