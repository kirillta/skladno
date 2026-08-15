import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

        expect(screen.queryByRole("button", { name: "Add rule" })).toBeNull();
        await user.click(screen.getByRole("button", { name: "Add writing sample" }));
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

        await user.click(screen.getByRole("button", { name: "Add writing sample" }));
        await user.type(screen.getByPlaceholderText("Sample text"), "A representative writing sample.");
        await user.click(screen.getByRole("button", { name: "Add" }));

        expect(add).toHaveBeenCalledWith("", "A representative writing sample.", undefined);
        expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("Generating source name"))).toBe(true);
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

    it("shows the profile rebuilt confirmation beside the rebuild action", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" corpus={{ items: [{ id: "sample-1", name: "Sample", characterCount: 4, wordCount: 1, excerpt: "Text", createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z", included: true, origin: "manual" }], rules: "", status: "outdated" }} findings={undefined} findingsStale={false} add={vi.fn()} remove={vi.fn()} setIncluded={vi.fn()} setRules={vi.fn()} rebuild={vi.fn().mockResolvedValue(undefined)} getArticleRules={vi.fn().mockResolvedValue("")} setArticleRules={vi.fn()} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Rebuild profile" }));
        expect(screen.getByText("Profile rebuilt from 1 active source.")).toBeTruthy();
    });

    it("shows whether custom rules are applied or unsaved", async () => {
        const user = userEvent.setup();
        const setRules = vi.fn().mockResolvedValue(undefined);
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" corpus={{ items: [], rules: "Use short sentences.", status: "outdated" }} findings={undefined} findingsStale={false} add={vi.fn()} remove={vi.fn()} setIncluded={vi.fn()} setRules={setRules} rebuild={vi.fn()} getArticleRules={vi.fn().mockResolvedValue("Use examples.")} setArticleRules={vi.fn()} /></IntlProvider>);

        expect(screen.getByText("Applied in style review.")).toBeTruthy();
        await user.clear(screen.getByLabelText("Global style rules"));
        await user.type(screen.getByLabelText("Global style rules"), "Use plain language.");
        expect(screen.getByText("Unsaved changes.")).toBeTruthy();
        await user.click(screen.getAllByRole("button", { name: "Save rules" })[0]);

        await waitFor(() => expect(screen.getAllByText("Applied in style review.").length).toBeGreaterThan(0));
    });

    it("confirms an immutable Article Revision snapshot and explains style findings", async () => {
        const user = userEvent.setup();
        const snapshotArticleRevision = vi.fn().mockResolvedValue(undefined);
        render(<IntlProvider locale="en" messages={messages}><StyleProfileView articleId="article-1" revisions={[{ id: "revision-1", articleId: "article-1", content: "Older", createdAt: "2026-08-14T00:00:00.000Z", provenance: { kind: "author-draft" } }, { id: "revision-2", articleId: "article-1", content: "Newer", createdAt: "2026-08-15T00:00:00.000Z", provenance: { kind: "author-draft" } }]} corpus={{ items: [{ id: "sample-1", name: "Snapshot", characterCount: 4, wordCount: 1, excerpt: "Text", createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z", included: true, origin: "manual" }], rules: "", status: "ready", profile: { version: 2, corpusItemCount: 1, characterCount: 4, confidence: "low", traits: [], phrasesToAvoid: [], contributorIds: ["sample-1"], rules: "", updatedAt: "2026-08-15T00:00:00.000Z" } }} findings={{ findings: [{ divergence: "Long opening", suggestion: "Shorten it", traitIds: ["transitions"] }], traitLabels: { transitions: "uses explicit transitions" } }} findingsStale={false} add={vi.fn()} remove={vi.fn()} setIncluded={vi.fn()} setRules={vi.fn()} rebuild={vi.fn()} getArticleRules={vi.fn().mockResolvedValue("")} setArticleRules={vi.fn()} snapshotArticleRevision={snapshotArticleRevision} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Add this Article" }));
        expect(screen.getByText("Choose a saved Revision to add as a writing sample. This creates a separate, immutable copy and does not change the Article.")).toBeTruthy();
        expect([...screen.getByLabelText("Saved Revision").querySelectorAll("option")].map((option) => [option.textContent, option.value])).toEqual([["Revision 2", "revision-2"], ["Revision 1", "revision-1"]]);
        await user.click(screen.getByRole("button", { name: "Add to corpus" }));

        await waitFor(() => expect(snapshotArticleRevision).toHaveBeenCalledWith("article-1", "revision-2"));
        expect(screen.getByText("1 source")).toBeTruthy();
        await user.click(screen.getByText("Show sources"));
        expect(screen.getAllByText("Snapshot")).toHaveLength(2);
        expect(screen.getByText("Grounded in uses explicit transitions")).toBeTruthy();
    });
});
