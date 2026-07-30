import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Article, ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { ArticleHeader } from "./components/ArticleHeader.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";


function article(id: string, title: string): Article {
    const revision: ArticleRevision = { id: `${id}-revision`, articleId: id, content: "Draft", createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } };
    return { id, title, createdAt: revision.createdAt, updatedAt: revision.createdAt, currentRevisionId: revision.id, currentRevision: revision };
}


function fakeClient(): EditorialWorkspaceClient {
    const created = article("new", "New Article");
    return {
        getHealth: vi.fn(), listArticles: vi.fn().mockResolvedValue([article("one", "First Article")]), createArticle: vi.fn().mockResolvedValue(created), renameArticle: vi.fn(), deleteArticle: vi.fn(), saveArticleRevision: vi.fn(), listArticleRevisions: vi.fn().mockResolvedValue([]), acceptProposal: vi.fn(), restoreRevision: vi.fn(), streamEditorial: vi.fn(), getStyleCorpus: vi.fn().mockResolvedValue({ items: [] }), addStyleCorpusItem: vi.fn(), removeStyleCorpusItem: vi.fn(), getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"), setPublishLimitProfile: vi.fn(),
    };
}


describe("Editorial Workspace", () => {
    it("selects an Article and creates a blank Article from the Article Library", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);
        expect(await screen.findByRole("heading", { name: "First Article" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "New article" }));
        expect(await screen.findByRole("heading", { name: "New Article" })).toBeTruthy();
    });


    it("creates a blank Article from the empty Article workspace", async () => {
        const client = fakeClient();
        client.listArticles = vi.fn().mockResolvedValue([]);
        const user = userEvent.setup();

        render(<App client={client} />);

        await user.click(await screen.findByRole("button", { name: "Create" }));

        expect(client.createArticle).toHaveBeenCalledWith({
            title: "Untitled article",
            content: ""
        });
    });


    it("offers focused editorial operations without applying a proposal", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);

        const panel = render(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" />);
        const panelScope = within(panel.container);

        expect(panelScope.getByText(/Suggestions stay separate from your Article until you accept them\./)).toBeTruthy();
        expect(panelScope.queryByRole("button", { name: "Thesis to narrative" })).toBeNull();

        await user.click(panelScope.getByRole("button", { name: "Quick actions" }));

        expect(panelScope.getByRole("button", { name: "Thesis to narrative" })).toBeTruthy();

        await user.type(panelScope.getByRole("textbox", { name: "Editorial guidance" }), "Preserve the key claims.");
        await user.click(panelScope.getByRole("button", { name: "Translation" }));
        expect(onRequest).not.toHaveBeenCalled();

        await user.click(panelScope.getByRole("button", { name: "Send editorial request" }));

        expect(onRequest).toHaveBeenCalledWith("translation", "Preserve the key claims.", "Portuguese");
    });


    it("selects a target language from the Article Header", async () => {
        const user = userEvent.setup();
        const setLanguage = vi.fn();
        const header = render(<ArticleHeader article={article("one", "First Article")} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} language="Spanish" setLanguage={setLanguage} />);
        const headerScope = within(header.container);

        expect(headerScope.getByRole("combobox", { name: "Target language" })).toBeTruthy();

        await user.selectOptions(headerScope.getByRole("combobox", { name: "Target language" }), "Portuguese");

        expect(setLanguage).toHaveBeenCalledWith("Portuguese");
    });
});
