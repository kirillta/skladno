import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../i18n/messages.js";
import { Button, IconButton } from "./primitives.js";


describe("Button", () => {
    it("renders an accessible disabled loading state without changing its footprint", () => {
        render(<IntlProvider locale="en" messages={messages}><Button compact state="loading" loadingLabel="Saving article">Save</Button></IntlProvider>);

        const button = screen.getByRole("button", { name: "Saving article" }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(button.getAttribute("aria-busy")).toBe("true");
        expect(screen.getByRole("status").textContent).toBe("Saving article");
        expect(screen.getByText("Save").className).toContain("invisible");
    });
});


describe("IconButton", () => {
    it("preserves keyboard activation, pressed semantics, and disabled behavior across variants", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const { rerender } = render(<IconButton variant="toolbar" label="Bold" aria-pressed={false} onClick={onClick}>B</IconButton>);
        const button = screen.getByRole("button", { name: "Bold", pressed: false });

        await user.tab();
        expect(document.activeElement).toBe(button);
        await user.keyboard(" ");
        expect(onClick).toHaveBeenCalledTimes(1);

        rerender(<IconButton variant="quiet" label="Bold" aria-pressed onClick={onClick}>B</IconButton>);
        expect(screen.getByRole("button", { name: "Bold", pressed: true })).toBe(button);

        rerender(<IconButton variant="danger" label="Stop" disabled onClick={onClick}>S</IconButton>);
        await user.click(screen.getByRole("button", { name: "Stop" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
