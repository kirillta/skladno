import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { articleContentForWorkspace, sortArticlesByActivity } from "./EditorialWorkspace.js";
import { article, fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: workspace.library.create-and-select, workspace.empty.create-article, workspace.navigation.persisted-view

describe("Editorial Workspace lifecycle", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("shows the restored Revision instead of a stale recoverable Draft", () => {
        const restored = article("one", "First Article");
        restored.currentRevision = { ...restored.currentRevision, id: "restored-revision", content: "one\ntwo\nthree" };
        restored.currentRevisionId = restored.currentRevision.id;
        restored.draft = {
            articleId: restored.id,
            content: "one\ntwo\nthree\nfour",
            baseRevisionId: "one-revision",
            version: 3,
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

        await waitFor(() => expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toEqual({
            version: 3,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: true,
            assistantCollapsed: false,
            proposalWarningsDismissed: false,
            view: "write",
            selectedArticleId: "one",
        }));
        expect(localStorage.getItem("skladno-navigation-collapsed")).toBeNull();
        expect(localStorage.getItem("skladno-assistant-collapsed")).toBeNull();
    });


    it("repairs malformed persisted workspace dimensions", async () => {
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 3,
            libraryWidth: "wide",
            assistantWidth: null,
            libraryCollapsed: "true",
            assistantCollapsed: false,
            proposalWarningsDismissed: "yes",
            view: "write",
        }));

        render(<App client={fakeClient()} />);
        await screen.findByRole("heading", { name: "First Article" });

        await waitFor(() => expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toMatchObject({
            version: 3,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
            proposalWarningsDismissed: false,
            view: "write",
        }));
    });


    it("restores the selected Article and Workspace View from local preferences", async () => {
        const client = fakeClient();
        client.listArticles = vi.fn().mockResolvedValue([article("one", "First Article"), article("two", "Second Article")]);
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 2,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
            selectedArticleId: "two",
            view: "revisions",
        }));

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "Second Article" });

        expect(screen.getByRole("tab", { name: "Revisions" }).getAttribute("aria-selected")).toBe("true");
    });



    it("orders Articles by the most recent persisted Article or Draft activity", () => {
        const older = article("z", "Older Article");
        older.updatedAt = "2026-01-01T00:00:00.000Z";
        const checkpointed = article("a", "Checkpointed Article");
        checkpointed.updatedAt = "2026-01-02T00:00:00.000Z";
        checkpointed.draft = {
            articleId: checkpointed.id,
            content: "Draft checkpoint",
            baseRevisionId: checkpointed.currentRevisionId,
            version: 1,
            updatedAt: "2026-01-03T00:00:00.000Z",
        };

        expect(sortArticlesByActivity([older, checkpointed]).map((item) => item.id)).toEqual(["a", "z"]);

        older.updatedAt = checkpointed.draft.updatedAt;
        delete checkpointed.draft;
        checkpointed.updatedAt = older.updatedAt;

        expect(sortArticlesByActivity([older, checkpointed]).map((item) => item.id)).toEqual(["a", "z"]);
    });



    it("selects an Article and creates a blank Article from the Article Library", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);
        expect(await screen.findByRole("heading", { name: "First Article" })).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("navigation.newArticle") }));
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
            publishingProfileId: "default",
        });
    });


    // product: application.open-settings-without-empty-workspace
    it("opens Application Settings without replacing the workspace with an empty view", async () => {
        const user = userEvent.setup();
        render(<App client={fakeClient()} />);

        await user.click((await screen.findAllByRole("button", { name: message("navigation.settings") })).at(-1)!);

        expect(screen.getByRole("heading", { name: message("settings.general") })).toBeTruthy();
        expect(screen.getByText("Preferred appearance")).toBeTruthy();
    });


    it("surfaces Application Settings save failures through the notification center", async () => {
        const client = fakeClient();
        client.updateGeneralSettings = vi.fn().mockRejectedValue(new Error("private settings detail"));
        const user = userEvent.setup();

        render(<App client={client} />);
        await user.click((await screen.findAllByRole("button", { name: message("navigation.settings") })).at(-1)!);
        const appearance = screen.getByText("Preferred appearance").closest("section")?.querySelector("select");
        await user.selectOptions(appearance!, "dark");

        expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t save your changes.");
        expect(screen.queryByText("private settings detail")).toBeNull();
    });


});
