import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { PublishingPreviewView } from "./PublishingPreviewView.js";


describe("PublishingPreviewView", () => {
    it("shows loading while copying plain text", async () => {
        const user = userEvent.setup();
        let resolveCopy: (() => void) | undefined;
        const copy = vi.fn(() => new Promise<void>((resolve) => {
            resolveCopy = resolve;
        }));
        render(<IntlProvider locale="en" messages={messages}><PublishingPreviewView publishing={{ text: "Prepared text", length: { count: 14, remaining: 86, state: "within-limit" }, copy }} /></IntlProvider>);

        const button = screen.getByRole("button", { name: "Copy plain text" });
        await user.click(button);

        expect(button.getAttribute("aria-busy")).toBe("true");
        expect((button as HTMLButtonElement).disabled).toBe(true);
        resolveCopy?.();
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });
});
