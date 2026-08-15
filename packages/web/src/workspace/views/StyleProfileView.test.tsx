import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "../../i18n/messages.js";
import { StyleProfileView } from "./StyleProfileView.js";

afterEach(cleanup);

describe("StyleProfileView", () => {
    it("warns when adding an empty writing sample", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" corpus={undefined} findings={undefined} findingsStale={false} add={vi.fn()} remove={vi.fn()} setIncluded={vi.fn()} setRules={vi.fn()} rebuild={vi.fn()} getArticleRules={vi.fn().mockResolvedValue("")} setArticleRules={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "+ Add" }));
        await user.click(screen.getByRole("button", { name: "Add" }));

        expect(screen.getByRole("alert").textContent).toContain("Enter a source name and paste text before adding.");
        expect(screen.getByPlaceholderText("Source name").getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByPlaceholderText("Source name").getAttribute("required")).not.toBeNull();
        expect(screen.getByPlaceholderText("Paste text here").getAttribute("required")).not.toBeNull();
    });
});
