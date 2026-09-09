import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLICATION_ERROR, ApplicationClientError, defaultGeneralSettings, type ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { article, fakeClient, renderLocalized, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace assistant", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenarios: workspace.assistant.quick-action
    it("restores the latest completed translation from local Assistant records", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "translations", selectedArticleId: "one" }));
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "spanish-translation-message", articleId: "one", role: "assistant", kind: "response", status: "completed", responseKind: "translation_proposal_prepared", baseRevisionId: "one-revision",
            translation: { content: "Borrador traducido", metadata: { targetLanguage: "Spanish", protectedSpans: [], title: "Título traducido" } },
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
            title: "Título traducido",
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



    it("inserts a Quick action before sending an editorial request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const updateArticle = vi.fn().mockResolvedValue(undefined);

        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} translationLanguages={["Portuguese"]} assistantMessages={[{ id: "greeting", articleId: "one", role: "assistant", kind: "greeting", status: "completed", template: "greeting", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]} article={article("one", "First Article")} updateArticle={updateArticle} />);
        const panelScope = within(panel.container);

        expect(panelScope.getByText(/I’m here to help shape this Article/)).toBeTruthy();
        expect(panelScope.queryByRole("button", { name: "Talking points" })).toBeNull();

        const quickActions = panelScope.getByRole("button", { name: message("assistant.quickActions") });
        expect(quickActions.getAttribute("aria-haspopup")).toBe("listbox");
        expect(quickActions.querySelector("svg")?.classList.contains("transition-transform")).toBe(true);
        await user.click(quickActions);

        expect(panelScope.getByRole("option", { name: "Talking points" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Narrative draft" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Flow and clarity" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Fact checking" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Style review" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Translation" })).toBeTruthy();

        await user.click(panelScope.getByRole("option", { name: message("assistant.skill.translation.label") }));
        expect(onRequest).not.toHaveBeenCalled();

        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("", "translation", ["Portuguese"], 0);
    });


    it("selects a Quick action", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} article={article("one", "First Article")} updateArticle={vi.fn()} />);
        const panelScope = within(panel.container);
        await user.click(panelScope.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: message("assistant.skill.narrativeDraft.label") }));
        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")?.textContent).toContain("Narrative draft"));

        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("", "narrative_draft", undefined, 0);
    });


    it("undoes composer edits with Ctrl+Z", async () => {
        const user = userEvent.setup();
        const execute = vi.fn();
        window.skladnoShell = { execute };
        render(<App client={fakeClient()} />);
        const composer = await screen.findByRole("combobox", { name: message("assistant.guidance") });

        await user.type(composer, "Draft guidance");
        await user.keyboard("{Control>}z{/Control}");

        await waitFor(() => expect(composer.textContent).toBe(""));
        expect(execute).not.toHaveBeenCalledWith("undo");
    });


    it("keeps native copy and paste shortcuts in the composer", async () => {
        const execute = vi.fn();
        window.skladnoShell = { execute };
        render(<App client={fakeClient()} />);
        const composer = await screen.findByRole("combobox", { name: message("assistant.guidance") });

        const copy = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true });
        const paste = new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true });

        composer.dispatchEvent(copy);
        composer.dispatchEvent(paste);
        expect(execute).toHaveBeenCalledWith("copy");
        expect(execute).toHaveBeenCalledWith("paste");
    });


    it("does not move focus to the composer when an Assistant request finishes", async () => {
        const user = userEvent.setup();
        let finishRequest: (() => void) | undefined;
        const onRequest = vi.fn(() => new Promise<void>((resolve) => {
            finishRequest = resolve;
        }));
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} assistantMessages={[]} />);
        const composer = within(panel.container).getByRole("combobox", { name: message("assistant.guidance") });
        const articleControl = document.createElement("button");
        panel.container.append(articleControl);

        await user.type(composer, "Review this");
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.send") }));
        articleControl.focus();
        finishRequest?.();

        await waitFor(() => expect(composer.textContent).toBe(""));
        expect(document.activeElement).toBe(articleControl);
    });


    it("sends the assistant request with Ctrl+Enter when configured", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} generalSettings={{ ...defaultGeneralSettings, assistantSendMode: "ctrl-enter" }} assistantMessages={[]} />);
        const composer = within(panel.container).getByRole("combobox", { name: message("assistant.guidance") });

        await user.click(within(panel.container).getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(within(panel.container).getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        fireEvent.keyDown(composer, { key: "Enter" });
        expect(onRequest).not.toHaveBeenCalled();

        fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });
        await waitFor(() => expect(onRequest).toHaveBeenCalledWith("", "talking_points", undefined, 0));
    });


    it("sends a selected skill without guidance as an Article request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} />);
        const panelScope = within(panel.container);

        await user.click(panelScope.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: message("assistant.skill.flowAndClarity.label") }));

        expect(panelScope.getByRole("button", { name: message("assistant.send") }).hasAttribute("disabled")).toBe(false);

        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("", "flow_and_clarity", undefined, 0);
    });

    it("creates a translation proposal for every configured default language", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" translationLanguages={["Spanish", "German"]} assistantMessages={[]} />);
        const panelScope = within(panel.container);

        await user.click(panelScope.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: message("assistant.skill.translation.label") }));
        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("", "translation", ["Spanish", "German"], 0);
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
