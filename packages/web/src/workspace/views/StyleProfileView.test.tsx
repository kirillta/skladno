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

        expect(screen.getByRole("alert").textContent).toContain("Paste text before adding.");
        expect(screen.getByText("Leave blank to generate a source name with your text model.")).toBeTruthy();
        expect(screen.getByPlaceholderText("Source name").getAttribute("required")).toBeNull();
        expect(screen.getByPlaceholderText("Sample text").getAttribute("required")).not.toBeNull();
    });

    it("adds text without a source name for generation", async () => {
        const user = userEvent.setup();
        let resolveAdd: (() => void) | undefined;
        const add = vi.fn(() => new Promise<void>((resolve) => {
            resolveAdd = resolve;
        }));
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" corpus={undefined} findings={undefined} findingsStale={false} add={add} remove={vi.fn()} setIncluded={vi.fn()} setRules={vi.fn()} rebuild={vi.fn()} getArticleRules={vi.fn().mockResolvedValue("")} setArticleRules={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "+ Add" }));
        await user.type(screen.getByPlaceholderText("Sample text"), "A representative writing sample.");
        await user.click(screen.getByRole("button", { name: "Add" }));

        expect(add).toHaveBeenCalledWith("", "A representative writing sample.", undefined);
        expect(screen.getByRole("status").textContent).toContain("Generating source name");
        expect(screen.getByRole("button", { name: "Generating source name" }).getAttribute("aria-busy")).toBe("true");
        resolveAdd?.();
    });

    it("confirms before removing a writing sample", async () => {
        const user = userEvent.setup();
        const remove = vi.fn().mockResolvedValue(undefined);
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" corpus={{ items: [{ id: "sample-1", name: "Sample", characterCount: 4, wordCount: 1, excerpt: "Text", createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z", included: true, origin: "manual" }], rules: "", status: "outdated" }} findings={undefined} findingsStale={false} add={vi.fn()} remove={remove} setIncluded={vi.fn()} setRules={vi.fn()} rebuild={vi.fn()} getArticleRules={vi.fn().mockResolvedValue("")} setArticleRules={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Remove" }));
        expect(remove).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Remove sample" }));
        expect(remove).toHaveBeenCalledWith("sample-1");
    });
});
