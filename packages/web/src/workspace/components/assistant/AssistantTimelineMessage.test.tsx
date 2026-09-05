import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import type { ComponentProps } from "react";
import { defaultGeneralSettings, type AssistantMessage } from "@skladno/shared";
import { describe, expect, it, vi } from "vitest";
import { messages } from "../../../i18n/messages.js";
import { AssistantTimelineMessage } from "./AssistantTimelineMessage.js";
import { AssistantMarkdown } from "./AssistantMarkdown.js";


function renderMessage(message: AssistantMessage, props: Partial<ComponentProps<typeof AssistantTimelineMessage>> = {}) {
    return render(<IntlProvider locale="en" messages={messages}><AssistantTimelineMessage message={message} generalSettings={{ ...defaultGeneralSettings, dateFormat: "iso", timeFormat: "24-hour", timeZone: "UTC" }} skillByRequest={new Map()} {...props} /></IntlProvider>);
}


describe("AssistantTimelineMessage", () => {
    it("replaces Markdown when a response body changes", async () => {
        const view = render(<IntlProvider locale="en" messages={messages}><AssistantMarkdown content="First response." /></IntlProvider>);

        expect(await screen.findByText("First response.")).toBeTruthy();
        view.rerender(<IntlProvider locale="en" messages={messages}><AssistantMarkdown content="Second response." /></IntlProvider>);

        expect(await screen.findByText("Second response.")).toBeTruthy();
        expect(screen.queryByText("First response.")).toBeNull();
    });


    it("renders read-only Markdown while keeping HTML and unsafe links inert", async () => {
        const { container } = renderMessage({ id: "response", articleId: "article", requestId: "request", role: "assistant", kind: "response", status: "completed", content: "**Bold** [safe](https://example.test) [unsafe](javascript:alert(1)) <img src=x onerror=alert(1)>", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });

        expect((await screen.findByText("Bold")).tagName).toBe("STRONG");
        expect(screen.getByRole("link", { name: "safe" }).getAttribute("href")).toBe("https://example.test");
        expect(container.querySelector("img, a[href^='javascript:']")).toBeNull();
        expect(container.querySelector("[contenteditable='false']")).toBeTruthy();
    });


    it("shows the handoff metadata without repeating a Workspace artifact body", async () => {
        const openView = vi.fn();
        const view = renderMessage({ id: "proposal", articleId: "article", requestId: "request", role: "assistant", kind: "response", status: "completed", responseKind: "proposal_prepared", skillId: "talking_points", skillSource: "explicit", content: "A long proposal owned by the Proposal View.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, { openView });
        const scope = within(view.container);

        expect(scope.getByText("Talking points prepared")).toBeTruthy();
        expect(scope.getByText("Completed")).toBeTruthy();
        expect(scope.getByText(/Selected skill/)).toBeTruthy();
        expect(scope.queryByText("A long proposal owned by the Proposal View.")).toBeNull();
        await userEvent.setup().click(scope.getByRole("button", { name: "Review Proposal" }));
        expect(openView).toHaveBeenCalledWith("proposal");
        expect(scope.getByText("2026-01-01, 00:00")).toBeTruthy();
    });


    it("retries failed and cancelled attempts by their original request ID", async () => {
        const onRetry = vi.fn();
        const view = renderMessage({ id: "failed", articleId: "article", requestId: "original-request", role: "assistant", kind: "response", status: "failed", content: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, { onRetry });

        await userEvent.setup().click(within(view.container).getByRole("button", { name: "Retry" }));
        expect(onRetry).toHaveBeenCalledWith("original-request");
    });
});
