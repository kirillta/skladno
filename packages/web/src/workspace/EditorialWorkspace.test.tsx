import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, publishLimitProfiles, type Article, type ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { articleContentForWorkspace } from "./EditorialWorkspace.js";
import { ArticleHeader } from "./components/ArticleHeader.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleStatusBar } from "./components/ArticleStatusBar.js";


function article(id: string, title: string): Article {
    const revision: ArticleRevision = { id: `${id}-revision`, articleId: id, content: "Draft", createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } };
    return { id, title, createdAt: revision.createdAt, updatedAt: revision.createdAt, currentRevisionId: revision.id, currentRevision: revision, workflowStage: "talking_points" };
}


function fakeClient(): EditorialWorkspaceClient {
    const created = article("new", "New Article");
    return {
        getHealth: vi.fn(), listArticles: vi.fn().mockResolvedValue([article("one", "First Article")]), createArticle: vi.fn().mockResolvedValue(created), updateArticle: vi.fn(), deleteArticle: vi.fn(), saveArticleDraft: vi.fn(), discardArticleDraft: vi.fn(), saveArticleRevision: vi.fn(), listArticleRevisions: vi.fn().mockResolvedValue([]), acceptProposal: vi.fn(), restoreRevision: vi.fn(), streamEditorial: vi.fn(), getStyleCorpus: vi.fn().mockResolvedValue({ items: [] }), addStyleCorpusItem: vi.fn(), removeStyleCorpusItem: vi.fn(), getPublishLimitProfile: vi.fn().mockResolvedValue("linkedin_post"), setPublishLimitProfile: vi.fn(), getApplicationSettings: vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [], modelPreferences: { defaultModel: "", operationOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} }), updateGeneralSettings: vi.fn(), updateBackupPolicy: vi.fn(), updateKeyBindingOverrides: vi.fn(), addOpenAiConnection: vi.fn(), updateOpenAiConnection: vi.fn(), removeOpenAiConnection: vi.fn(), setActiveOpenAiConnection: vi.fn(), testOpenAiConnection: vi.fn(), refreshOpenAiModels: vi.fn(), updateModelPreferences: vi.fn(),
    };
}


describe("Editorial Workspace", () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
    });


    it("shows the restored Revision instead of a stale recoverable Draft", () => {
        const restored = article("one", "First Article");
        restored.currentRevision = { ...restored.currentRevision, id: "restored-revision", content: "one\ntwo\nthree" };
        restored.currentRevisionId = restored.currentRevision.id;
        restored.draft = {
            articleId: restored.id,
            content: "one\ntwo\nthree\nfour",
            baseRevisionId: "one-revision",
            version: 2,
            updatedAt: "2026-01-01T00:01:00.000Z",
        };

        expect(articleContentForWorkspace(restored)).toBe("one\ntwo\nthree");
    });

    it("migrates legacy panel choices into the versioned workspace layout preference", async () => {
        localStorage.clear();
        localStorage.setItem("skladno-navigation-collapsed", "true");
        localStorage.setItem("skladno-assistant-collapsed", "false");

        render(<App client={fakeClient()} />);
        await screen.findByRole("heading", { name: "First Article" });

        expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toEqual({
            version: 1,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: true,
            assistantCollapsed: false,
        });
        expect(localStorage.getItem("skladno-navigation-collapsed")).toBeNull();
        expect(localStorage.getItem("skladno-assistant-collapsed")).toBeNull();
    });


    it("keeps the Article Workspace first while resizing panels with accessible separators", async () => {
        localStorage.clear();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 1,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
        }));
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);

        await screen.findByRole("heading", { name: "First Article" });

        const libraryResize = screen.getByRole("separator", { name: "Resize Article Library Panel" });
        const assistantResize = screen.getByRole("separator", { name: "Resize Editorial Assistant Panel" });
        const main = libraryResize.closest("main")!;

        expect(main.firstElementChild?.tagName).toBe("SECTION");

        expect(libraryResize.getAttribute("aria-valuemin")).toBe("192");
        expect(libraryResize.getAttribute("aria-valuemax")).toBe("280");
        await user.click(libraryResize);
        await user.keyboard("{ArrowRight}");
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("224");

        fireEvent.keyDown(libraryResize, { key: "End" });
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("280");
        fireEvent.keyDown(libraryResize, { key: "Home" });
        fireEvent.pointerDown(libraryResize, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(window, { clientX: 132, pointerId: 1 });
        fireEvent.pointerUp(window, { pointerId: 1 });
        expect(libraryResize.getAttribute("aria-valuenow")).toBe("224");
        fireEvent.keyDown(assistantResize, { key: "Home" });
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("320");
        fireEvent.pointerDown(assistantResize, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(window, { clientX: 68, pointerId: 1 });
        fireEvent.pointerUp(window, { pointerId: 1 });
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("352");
        fireEvent.keyDown(assistantResize, { key: "End" });
        expect(assistantResize.getAttribute("aria-valuemax")).toBe("576");
        expect(assistantResize.getAttribute("aria-valuenow")).toBe("576");
        expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toMatchObject({ libraryWidth: 224, assistantWidth: 576 });
    });
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
            content: "",
            language: "en",
        });
    });


    it("opens Application Settings without replacing the workspace with an empty view", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);

        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);

        expect(screen.getByRole("heading", { name: "General" })).toBeTruthy();
        expect(screen.getByText("Preferred appearance")).toBeTruthy();
    });


    it("surfaces Application Settings save failures through the notification center", async () => {
        const client = fakeClient();
        client.updateGeneralSettings = vi.fn().mockRejectedValue(new Error("private settings detail"));
        const user = userEvent.setup();

        render(<App client={client} />);
        await user.click((await screen.findAllByRole("button", { name: "Settings" })).at(-1)!);
        await user.selectOptions(screen.getAllByRole("combobox")[0]!, "dark");

        expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t save your changes.");
        expect(screen.queryByText("private settings detail")).toBeNull();
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
        const header = render(<ArticleHeader article={article("one", "First Article")} updateArticle={vi.fn()} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} language="Spanish" setLanguage={setLanguage} />);
        const headerScope = within(header.container);

        expect(headerScope.getByRole("combobox", { name: "Target language" })).toBeTruthy();

        await user.selectOptions(headerScope.getByRole("combobox", { name: "Target language" }), "Portuguese");

        expect(setLanguage).toHaveBeenCalledWith("Portuguese");
    });


    it("updates workflow stage as Article metadata without an editorial request", async () => {
        const user = userEvent.setup();
        const updateArticle = vi.fn().mockResolvedValue(undefined);
        const header = render(<ArticleHeader article={article("one", "First Article")} updateArticle={updateArticle} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} language="Spanish" setLanguage={vi.fn()} />);

        await user.click(within(header.container).getByRole("button", { name: "Fact-checking" }));

        expect(updateArticle).toHaveBeenCalledWith("one", { workflowStage: "fact_checking" });
    });


    it("renames an Article from its header when editing finishes", async () => {
        const user = userEvent.setup();
        const updateArticle = vi.fn().mockResolvedValue(undefined);
        const header = render(<ArticleHeader article={article("one", "Untitled article")} updateArticle={updateArticle} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} language="Spanish" setLanguage={vi.fn()} />);
        const headerScope = within(header.container);

        await user.click(headerScope.getByRole("button", { name: "Rename article: Untitled article" }));
        await user.clear(headerScope.getByRole("textbox", { name: "Article title" }));
        await user.type(headerScope.getByRole("textbox", { name: "Article title" }), "A better title");
        await user.tab();

        expect(updateArticle).toHaveBeenCalledWith("one", { title: "A better title" });
    });


    it("shows a sequential revision number and character count in the Article Status Bar", () => {
        const statusBar = render(<ArticleStatusBar revisionNumber={2} characterCount={1234} profile={publishLimitProfiles[1]!} setProfile={vi.fn()} />);
        const statusBarScope = within(statusBar.container);

        expect(statusBarScope.getByText("v2")).toBeTruthy();
        expect(statusBarScope.getByRole("button", { name: /Character count: .* of .* characters/ })).toBeTruthy();
        expect(statusBarScope.queryByText("Saved")).toBeNull();
    });


    it("selects a publishing character limit from the Article Status Bar", async () => {
        const user = userEvent.setup();
        const setProfile = vi.fn().mockResolvedValue(undefined);
        const statusBar = render(<ArticleStatusBar revisionNumber={1} characterCount={0} profile={publishLimitProfiles[1]!} setProfile={setProfile} />);
        const statusBarScope = within(statusBar.container);

        await user.click(statusBarScope.getByRole("button", { name: /Character count: 0 of .* characters/ }));
        await user.click(statusBarScope.getByRole("menuitemradio", { name: /LinkedIn short post/ }));

        expect(setProfile).toHaveBeenCalledWith("linkedin-short");
    });
});
