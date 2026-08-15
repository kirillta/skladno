import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { ArticleRevision } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { RestoreRevisionDialog } from "./RestoreRevisionDialog.js";


const candidate: ArticleRevision = {
    id: "revision-1",
    articleId: "article-1",
    content: "Earlier text",
    createdAt: "2026-01-01T00:00:00.000Z",
    provenance: { kind: "author-draft" },
};


describe("RestoreRevisionDialog", () => {
    it("shows loading while restoring and disables alternate actions", async () => {
        const user = userEvent.setup();
        let resolveRestore: (() => void) | undefined;
        const restore = vi.fn(() => new Promise<void>((resolve) => {
            resolveRestore = resolve;
        }));
        render(<IntlProvider locale="en" messages={messages}><RestoreRevisionDialog candidate={candidate} hasUncommittedChanges close={vi.fn()} restore={restore} /></IntlProvider>);

        const button = screen.getByRole("button", { name: "Save and restore" });
        await user.click(button);

        expect(button.getAttribute("aria-busy")).toBe("true");
        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Discard Draft and restore" }) as HTMLButtonElement).disabled).toBe(true);
        resolveRestore?.();
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });
});
