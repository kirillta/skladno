import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLICATION_ERROR, ApplicationClientError, defaultGeneralSettings, type ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { article, fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace assistant requests", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("restores the latest completed translation from local Assistant records", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "translations", selectedArticleId: "one" }));
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "spanish-translation-message", articleId: "one", role: "assistant", kind: "response", status: "completed", responseKind: "translation_proposal_prepared", baseRevisionId: "one-revision",
            translation: { content: "Borrador traducido", metadata: { targetLanguage: "Spanish", protectedSpans: [], title: "TÃ­tulo traducido" } },
            createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        }, {
            id: "german-translation-message", articleId: "one", role: "assistant", kind: "response", status: "completed", responseKind: "translation_proposal_prepared", baseRevisionId: "one-revision",
            translation: { content: "Deutscher Entwurf", metadata: { targetLanguage: "German", protectedSpans: [] } },
            createdAt: "2026-01-01T00:01:00.000Z", updatedAt: "2026-01-01T00:01:00.000Z",
        }]);

        render(<App client={client} />);

        expect(await screen.findByText("Deutscher Entwurf")).toBeTruthy();
        await user.click(screen.getByRole("tab", { name: "Spanish" }));
        expect(screen.getByText("Borrador traducido")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Edit Spanish translation" }));
        expect(client.createArticle).toHaveBeenCalledWith(expect.objectContaining({
            title: "TÃ­tulo traducido",
            content: "Borrador traducido",
            sourceArticleId: "one",
            sourceRevisionId: "one-revision",
        }));
    });

    // product: application.desktop-shell-layout
    it("keeps Assistant conversations isolated to the selected Article", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 2,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
            view: "write",
            selectedArticleId: "one",
        }));
        client.listArticles = vi.fn().mockResolvedValue([article("one", "First Article"), article("two", "Second Article")]);
        client.listAssistantMessages = vi.fn().mockImplementation(async (articleId: string) => [{
            id: `${articleId}-message`,
            articleId,
            role: "assistant" as const,
            kind: "response" as const,
            status: "completed" as const,
            content: articleId === "one" ? "First Article conversation" : "Second Article conversation",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]);

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "First Article" });
        expect(await screen.findByText("First Article conversation")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: /Second Article/ }));

        expect(await screen.findByText("Second Article conversation")).toBeTruthy();
        expect(screen.queryByText("First Article conversation")).toBeNull();
    });

    it("keeps Assistant request errors on the Article where they occurred", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({
            version: 2,
            libraryWidth: 208,
            assistantWidth: 384,
            libraryCollapsed: false,
            assistantCollapsed: false,
            view: "write",
            selectedArticleId: "one",
        }));
        client.listArticles = vi.fn().mockResolvedValue([article("one", "First Article"), article("two", "Second Article")]);
        client.streamAssistantRequest = vi.fn().mockRejectedValue(new Error("connection failed"));

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "First Article" });
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        expect((await screen.findByRole("alert")).textContent).toContain("complete this editorial request.");
        const errorDetails = screen.getByText("Error details").closest("details");
        expect(errorDetails?.open).toBe(false);
        await user.click(screen.getByText("Error details"));
        expect(errorDetails?.open).toBe(true);
        expect(screen.getByText("Couldn't start that AI-assisted action. Your Article was not changed. Try again, or check your AI connection in Settings.")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: /Second Article/ }));

        await screen.findByRole("heading", { name: "Second Article" });
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("opens Application Settings after an unavailable AI connection without changing the Article or Workspace View", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "revisions", selectedArticleId: "one" }));
        client.streamAssistantRequest = vi.fn().mockRejectedValue(new ApplicationClientError(APPLICATION_ERROR.ACTIVE_CONNECTION_REQUIRED, undefined, 400));

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "First Article" });
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));
        await user.click(await screen.findByRole("button", { name: "Open Application Settings" }));
        await user.click(screen.getAllByRole("button", { name: "Back to workspace" })[0]);

        expect(screen.getByRole("heading", { name: "First Article" })).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Revisions" }).getAttribute("aria-selected")).toBe("true");
        expect(client.saveArticleRevision).not.toHaveBeenCalled();
    });

    it("uses the promoted Revision for every configured translation", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        const promoted: ArticleRevision = { ...article("one", "First Article").currentRevision, id: "promoted-revision", content: "Changed Draft" };
        const source = article("one", "First Article");
        source.draft = { articleId: source.id, content: promoted.content, baseRevisionId: source.currentRevisionId, version: 1, updatedAt: promoted.createdAt };
        client.listArticles = vi.fn().mockResolvedValue([source]);
        client.getApplicationSettings = vi.fn().mockResolvedValue({ general: { ...defaultGeneralSettings, defaultTranslationLanguages: ["es", "de"] }, connections: [], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} });
        client.saveArticleDraft = vi.fn().mockResolvedValue(source.draft);
        client.saveArticleRevision = vi.fn().mockResolvedValue(promoted);

        render(<App client={client} />);
        await screen.findByRole("textbox", { name: "Article draft" });
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.translation.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        await waitFor(() => expect(client.streamAssistantRequest).toHaveBeenCalledTimes(2));
        expect(vi.mocked(client.streamAssistantRequest).mock.calls.map(([, request]) => request.kind === "new" ? request.scope.baseRevisionId : undefined)).toEqual([promoted.id, promoted.id]);
    });
});
