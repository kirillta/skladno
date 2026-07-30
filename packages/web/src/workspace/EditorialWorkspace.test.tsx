import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Article, ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import type { EditorialWorkspaceClient } from "../application-client.js";


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
    it("selects an Article and creates a new Article from the Article Library", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);
        expect(await screen.findByRole("heading", { name: "First Article" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "New article" }));
        await user.type(screen.getByRole("textbox", { name: "Article title" }), "New Article");
        await user.click(screen.getByRole("button", { name: "Create Article" }));
        expect(await screen.findByRole("heading", { name: "New Article" })).toBeTruthy();
    });
});
