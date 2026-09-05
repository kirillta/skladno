import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLICATION_ERROR, ApplicationClientError, defaultGeneralSettings, type AssistantEvent, type ArticleRevision } from "@skladno/shared";

import { App } from "../App.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { requestedTranslationLanguages } from "./state/assistant-messages-state.js";
import { article, fakeClient, renderLocalized, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: workspace.assistant.quick-action, workspace.assistant.selection-deselection

describe("Editorial Workspace assistant", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // product: editorial-workflows.assistant-streaming-block-handoff
    it("reveals stable streaming blocks and hands review output to one result card", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        let emit: ((event: AssistantEvent) => void) | undefined;
        let finish: (() => void) | undefined;
        let completed = false;
        client.listAssistantMessages = vi.fn().mockImplementation(async () => completed ? [{
            id: "proposal-message", articleId: "one", requestId: "request", role: "assistant" as const, kind: "response" as const, status: "completed" as const, responseKind: "proposal_prepared" as const, content: "Full Proposal", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        }] : []);
        client.streamAssistantRequest = vi.fn(async (_articleId, _input, onEvent) => new Promise<void>((resolve) => {
            emit = onEvent;
            finish = resolve;
        }));

        render(<App client={client} />);
        await screen.findByRole("heading", { name: "First Article" });
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));
        await waitFor(() => expect(emit).toBeDefined());

        act(() => emit?.({ type: "text_delta", requestId: "request", delta: "Hidden" }));
        expect(screen.queryByText("Hidden")).toBeNull();
        act(() => emit?.({ type: "text_delta", requestId: "request", delta: " paragraph.\n\n# Heading\n" }));
        const paragraph = await screen.findByText("Hidden paragraph.");
        const timeline = document.querySelector<HTMLElement>("[aria-live='polite']")!;
        Object.defineProperties(timeline, { clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 500 } });
        timeline.scrollTop = 120;
        fireEvent.scroll(timeline);
        act(() => emit?.({ type: "text_delta", requestId: "request", delta: "- First item\n" }));
        expect(screen.getByText("Hidden paragraph.")).toBe(paragraph);
        expect(timeline.scrollTop).toBe(120);

        act(() => emit?.({ type: "staged_completion", requestId: "request", completion: { responseKind: "proposal_prepared" } }));
        expect(screen.getByRole("button", { name: "Review Proposal" })).toBeTruthy();
        expect(screen.queryByText("Hidden paragraph.")).toBeNull();
        act(() => emit?.({ type: "completed", requestId: "request", responseKind: "proposal_prepared", messageId: "proposal-message", result: { proposal: "Full Proposal" } }));
        completed = true;
        act(() => finish?.());
        await waitFor(() => expect(screen.getAllByRole("button", { name: "Review Proposal" })).toHaveLength(1));
        expect(screen.queryByText("Full Proposal")).toBeNull();
    });

    it("restores the latest completed Proposal Review from local Assistant records", async () => {
        const client = fakeClient();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "proposal", selectedArticleId: "one" }));
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "proposal-message",
            articleId: "one",
            requestId: "proposal-request",
            role: "assistant",
            kind: "response",
            status: "completed",
            responseKind: "proposal_prepared",
            baseRevisionId: "one-revision",
            baseRevisionContent: "Draft",
            proposalContent: "Improved Draft",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]);

        render(<App client={client} />);

        expect(await screen.findByText("Replacement · Change 1 of 1")).toBeTruthy();
        expect(screen.getByText("Improved Draft")).toBeTruthy();
    });


    it("keeps the current Workspace View when an Assistant request prepares a Proposal", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "write", selectedArticleId: "one" }));
        client.streamAssistantRequest = vi.fn(async (_articleId, _input, onEvent) => {
            onEvent({ type: "completed", requestId: "proposal-request", responseKind: "proposal_prepared", messageId: "proposal-message", result: { proposal: "Improved Draft" } });
        });

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "First Article" });
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        await waitFor(() => expect(client.streamAssistantRequest).toHaveBeenCalled());
        expect(screen.getByRole("tab", { name: "Write" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.queryByText("Improved Draft")).toBeNull();
    });


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
        expect(screen.getByText("The editorial request failed. Retry it in a moment.")).toBeTruthy();
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


    it("requests only the supported translation named in the Author guidance", () => {
        expect(requestedTranslationLanguages("German", ["es", "en"])).toEqual(["de"]);
    });


    it("summarizes an Article selection in a compact composer chip", () => {
        const selection = { articleId: "one", fingerprint: "fingerprint", preview: "The first selected sentence provides enough context to identify the excerpt.", startOffset: 0, endOffset: 72 };
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} selection={selection} clearSelection={vi.fn()} />);
        const selectionChip = panel.container.querySelector<HTMLElement>("[data-assistant-composer-decoration]")!;

        expect(selectionChip.textContent).toContain("The first selected s…");
        expect(selectionChip.getAttribute("title")).toBe(selection.preview);
        expect(within(selectionChip).getByRole("button", { name: message("assistant.clearArticleSelection") })).toBeTruthy();
    });


    it("keeps selected Article text while moving to the composer and drops it when cleared", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        const source = article("one", "First Article");
        source.draft = { articleId: source.id, content: source.currentRevision.content, baseRevisionId: source.currentRevisionId, version: 1, updatedAt: source.updatedAt };
        client.listArticles = vi.fn().mockResolvedValue([source]);
        client.saveArticleDraft = vi.fn().mockResolvedValue(source.draft);
        client.saveArticleRevision = vi.fn().mockResolvedValue(source.currentRevision);
        render(<App client={client} />);
        const editor = await screen.findByRole("textbox", { name: "Article draft" });
        const text = editor.firstChild;
        expect(text).toBeTruthy();

        const selection = window.getSelection()!;
        selection.setBaseAndExtent(text!, 0, text!, 1);
        fireEvent(document, new Event("selectionchange"));
        fireEvent.mouseUp(editor);
        expect(await screen.findByLabelText(message("assistant.articleSelection"))).toBeTruthy();
        await waitFor(() => expect(editor.textContent).toBe("Draft"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(screen.getByLabelText(message("assistant.articleSelection"))).toBeTruthy();

        await user.click(screen.getByRole("combobox", { name: message("assistant.guidance") }));
        expect(screen.getByLabelText(message("assistant.articleSelection"))).toBeTruthy();

        await user.click(screen.getByRole("button", { name: message("assistant.clearArticleSelection") }));
        await waitFor(() => expect(screen.queryByLabelText(message("assistant.articleSelection"))).toBeNull());
        await user.click(screen.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(screen.getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        await waitFor(() => expect(client.streamAssistantRequest).toHaveBeenCalled());
        expect(vi.mocked(client.streamAssistantRequest).mock.calls[0]?.[1]).toMatchObject({ scope: { kind: "article" } });
    });


    it("keeps Talking points active when an Article selection becomes the priority source", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} />);
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(within(panel.container).getByRole("option", { name: message("assistant.skill.talkingPoints.label") }));
        expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeTruthy();

        panel.rerender(<IntlProvider locale="en" messages={messages}><EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} selection={{ articleId: "one", fingerprint: "fingerprint", preview: "Selected Article text", startOffset: 0, endOffset: 21 }} clearSelection={vi.fn()} /></IntlProvider>);

        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeTruthy());
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.quickActions") }));
        expect(within(panel.container).getByRole("option", { name: message("assistant.skill.narrativeDraft.label") })).toBeTruthy();
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("", "talking_points", undefined, 0);
    });


    it("returns an expanded Assistant Panel to the latest message", async () => {
        const user = userEvent.setup();
        const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
            configurable: true,
            get: () => 640,
        });


        function AssistantPanelHarness() {
            const [collapsed, setCollapsed] = useState(false);

            return <EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={collapsed} setCollapsed={setCollapsed} language="Portuguese" assistantMessages={[
                { id: "greeting", articleId: "one", role: "assistant", kind: "greeting", status: "completed", template: "greeting", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
                { id: "latest", articleId: "one", role: "assistant", kind: "response", status: "completed", content: "The latest response.", createdAt: "2026-01-01T00:01:00.000Z", updatedAt: "2026-01-01T00:01:00.000Z" },
            ]} />;
        }


        try {
            const panel = renderLocalized(<AssistantPanelHarness />);
            const timeline = () => panel.container.querySelector<HTMLElement>('aside[data-workspace-panel="editorial-assistant"] > div')!;

            expect(timeline().scrollTop).toBe(640);

            await user.click(within(panel.container).getByRole("button", { name: message("assistant.collapse") }));
            await user.click(within(panel.container).getByRole("button", { name: message("assistant.expand") }));

            expect(timeline().scrollTop).toBe(640);
        } finally {
            if (scrollHeight)
                Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeight);
            else
                Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
        }
    });


    it("formats Assistant timeline timestamps with the configured preferences", () => {
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" generalSettings={{ ...defaultGeneralSettings, dateFormat: "iso", timeFormat: "24-hour", timeZone: "America/New_York" }} assistantMessages={[{ id: "greeting", articleId: "one", role: "assistant", kind: "greeting", status: "completed", template: "greeting", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]} />);

        expect(within(panel.container).getByText("2025-12-31, 19:00")).toBeTruthy();
    });


    it("shows an Article selection chip in the persisted Author message", () => {
        renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[{
            id: "author-selection",
            articleId: "one",
            role: "author",
            kind: "message",
            status: "completed",
            content: "Please review this.",
            selectionText: "Selected Article text",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]} />);

        const selection = screen.getByLabelText("Article selection");
        expect(selection.getAttribute("title")).toBe("Selected Article text");
        expect(selection.textContent).toContain("Selected Article tex");
        expect(selection.parentElement?.textContent).toContain("Please review this.");
    });


    // product: editorial-workflows.assistant-request-proposal
    it("shows selected skills without Author text and names skill-specific proposals", () => {
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[
            { id: "author", articleId: "one", requestId: "request", role: "author", kind: "message", status: "completed", content: "Organize these ideas.", skillOffset: "Organize ".length, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
            { id: "response", articleId: "one", requestId: "request", role: "assistant", kind: "response", status: "completed", skillId: "talking_points", responseKind: "proposal_prepared", editorialArtifactId: "proposal", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
            { id: "narrative-author", articleId: "one", requestId: "narrative-request", role: "author", kind: "message", status: "completed", content: "", skillId: "narrative_draft", skillOffset: 0, createdAt: "2026-01-01T00:00:02.000Z", updatedAt: "2026-01-01T00:00:02.000Z" },
            { id: "narrative-response", articleId: "one", requestId: "narrative-request", role: "assistant", kind: "response", status: "completed", responseKind: "proposal_prepared", editorialArtifactId: "narrative-proposal", createdAt: "2026-01-01T00:00:03.000Z", updatedAt: "2026-01-01T00:00:03.000Z" },
        ]} />);
        const panelScope = within(panel.container);
        const [review] = panelScope.getAllByRole("button", { name: "Review Proposal" });
        const timestamp = [...panel.container.querySelectorAll("time")].at(-1)!;

        expect(panelScope.getByText("Talking points")).toBeTruthy();
        expect(panelScope.getByText("Talking points prepared")).toBeTruthy();
        expect(panelScope.getAllByText("Narrative draft")).toHaveLength(1);
        expect(panelScope.getByText("Narrative draft prepared")).toBeTruthy();
        const authorContent = panel.container.querySelector('article[aria-label="Talking points"] p')!;
        expect(authorContent.childNodes[0]?.textContent).toBe("Organize ");
        expect(authorContent.childNodes[1]?.textContent).toBe("Talking points");
        expect(panel.container.querySelector('article[aria-label="Narrative draft"] p')?.textContent).toBe("Narrative draft");
        expect(review.compareDocumentPosition(timestamp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });


});
