import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { messages } from "../i18n/messages.js";
import { Button } from "./primitives.js";


describe("Button", () => {
    it("renders an accessible disabled loading state without changing its footprint", () => {
        render(<IntlProvider locale="en" messages={messages}><Button state="loading" loadingLabel="Saving article">Save</Button></IntlProvider>);

        const button = screen.getByRole("button", { name: "Saving article" }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(button.getAttribute("aria-busy")).toBe("true");
        expect(screen.getByRole("status").textContent).toBe("Saving article");
        expect(screen.getByText("Save").className).toContain("invisible");
    });
});
