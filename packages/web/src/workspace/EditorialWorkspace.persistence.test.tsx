import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App.js";
import { getArticleContentForWorkspace, sortArticlesByActivity } from "./EditorialWorkspace.js";
import { createArticleFixture, createFakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenario: workspace.navigation.persisted-view

describe("Editorial Workspace persistence", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("shows the restored Revision instead of a stale recoverable Draft", () => {
        const restored = createArticleFixture("one", "First Article");
        restored.currentRevision = { ...restored.currentRevision, id: "restored-revision", content: "one\ntwo\nthree" };
        restored.currentRevisionId = restored.currentRevision.id;
        restored.draft = { articleId: restored.id, content: "one\ntwo\nthree\nfour", baseRevisionId: "one-revision", version: 3, updatedAt: "2026-01-01T00:01:00.000Z" };
        expect(getArticleContentForWorkspace(restored)).toBe("one\ntwo\nthree");
    });

    it("migrates legacy panel choices into the versioned workspace layout preference", async () => {
        localStorage.clear();
        localStorage.setItem("skladno-navigation-collapsed", "true");
        localStorage.setItem("skladno-assistant-collapsed", "false");
        render(<App client={createFakeClient()} />);
        await screen.findByRole("heading", { name: "First Article" });
        await waitFor(() => expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toEqual({ version: 4, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: true, assistantCollapsed: false, proposalWarningsDismissed: false, selectedTranslationLanguages: {}, view: "write", selectedArticleId: "one" }));
        expect(localStorage.getItem("skladno-navigation-collapsed")).toBeNull();
        expect(localStorage.getItem("skladno-assistant-collapsed")).toBeNull();
    });

    it("repairs malformed persisted workspace dimensions", async () => {
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: "wide", assistantWidth: null, libraryCollapsed: "true", assistantCollapsed: false, proposalWarningsDismissed: "yes", selectedTranslationLanguages: { invalid: 1, one: "Spanish" }, view: "write" }));
        render(<App client={createFakeClient()} />);
        await screen.findByRole("heading", { name: "First Article" });
        await waitFor(() => expect(JSON.parse(localStorage.getItem("skladno-workspace-layout")!)).toMatchObject({ version: 4, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, selectedTranslationLanguages: { one: "Spanish" }, view: "write" }));
    });

    it("restores the selected Article and Workspace View from local preferences", async () => {
        const client = createFakeClient();
        client.listArticles = vi.fn().mockResolvedValue([createArticleFixture("one", "First Article"), createArticleFixture("two", "Second Article")]);
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 2, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, selectedArticleId: "two", view: "revisions" }));
        render(<App client={client} />);
        await screen.findByRole("heading", { name: "Second Article" });
        expect(screen.getByRole("tab", { name: "Revisions" }).getAttribute("aria-selected")).toBe("true");
    });

    it("orders Articles by the most recent persisted Article or Draft activity", () => {
        const older = createArticleFixture("z", "Older Article");
        older.updatedAt = "2026-01-01T00:00:00.000Z";
        const checkpointed = createArticleFixture("a", "Checkpointed Article");
        checkpointed.updatedAt = "2026-01-02T00:00:00.000Z";
        checkpointed.draft = { articleId: checkpointed.id, content: "Draft checkpoint", baseRevisionId: checkpointed.currentRevisionId, version: 1, updatedAt: "2026-01-03T00:00:00.000Z" };
        expect(sortArticlesByActivity([older, checkpointed]).map((item) => item.id)).toEqual(["a", "z"]);
        older.updatedAt = checkpointed.draft.updatedAt;
        delete checkpointed.draft;
        checkpointed.updatedAt = older.updatedAt;
        expect(sortArticlesByActivity([older, checkpointed]).map((item) => item.id)).toEqual(["a", "z"]);
    });
});
