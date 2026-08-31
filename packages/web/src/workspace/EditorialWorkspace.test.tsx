import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, defaultPublishingSettings, publishLimitProfiles, type Article, type ArticleRevision } from "@skladno/shared";
import { IntlProvider } from "react-intl";
import { useState, type ReactElement } from "react";

import { App } from "../App.js";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { articleContentForWorkspace, sortArticlesByActivity } from "./EditorialWorkspace.js";
import { ArticleHeader } from "./components/ArticleHeader.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { ArticleStatusBar } from "./components/ArticleStatusBar.js";
import { requestedTranslationLanguages } from "./state/assistant-messages-state.js";


// Product scenarios: workspace.library.create-and-select, workspace.assistant.quick-action, workspace.empty.create-article, workspace.header.metadata-and-deletion, workspace.navigation.persisted-view, workspace.publishing.over-guidance, history-and-publishing.publishing-guidance, cross-cutting.accessible-workspace-separators

function article(id: string, title: string): Article {
    const revision: ArticleRevision = { id: `${id}-revision`, articleId: id, content: "Draft", createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } };
    return { id, title, createdAt: revision.createdAt, updatedAt: revision.createdAt, currentRevisionId: revision.id, currentRevision: revision };
}


function renderLocalized(element: ReactElement) {
    return render(<IntlProvider locale="en" messages={messages}>{element}</IntlProvider>);
}


function fakeClient(): EditorialWorkspaceClient {
    const created = article("new", "New Article");
    return {
        getHealth: vi.fn(), listArticles: vi.fn().mockResolvedValue([article("one", "First Article")]), createArticle: vi.fn().mockResolvedValue(created), updateArticle: vi.fn(), deleteArticle: vi.fn(), saveArticleDraft: vi.fn(), discardArticleDraft: vi.fn(), saveArticleRevision: vi.fn(), listArticleRevisions: vi.fn().mockResolvedValue([]), listAssistantMessages: vi.fn().mockResolvedValue([]), streamAssistantRequest: vi.fn(), acceptProposal: vi.fn(), summarizeProposal: vi.fn().mockResolvedValue([]), restoreRevision: vi.fn(), streamEditorial: vi.fn(), getStyleCorpus: vi.fn().mockResolvedValue({ items: [], rules: "", status: "empty" }), addStyleCorpusItem: vi.fn(), removeStyleCorpusItem: vi.fn(), setStyleCorpusItemIncluded: vi.fn(), setStyleCorpusRules: vi.fn(), rebuildStyleCorpus: vi.fn(), getArticleStyleRules: vi.fn().mockResolvedValue(""), setArticleStyleRules: vi.fn(), getPublishingSettings: vi.fn().mockResolvedValue(defaultPublishingSettings), setPublishingSettings: vi.fn(), getApplicationSettings: vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} }), updateGeneralSettings: vi.fn(), updateBackupPolicy: vi.fn(), updateKeyBindingOverrides: vi.fn(), addAiConnection: vi.fn(), updateAiConnection: vi.fn(), removeAiConnection: vi.fn(), setActiveAiConnection: vi.fn(), testAiConnection: vi.fn(), refreshAiModels: vi.fn(), updateModelPreferences: vi.fn(),
    } as unknown as EditorialWorkspaceClient;
}


describe("Editorial Workspace", () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
        window.skladnoUpdates = undefined;
    });


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


    it("opens Proposal Review when an Assistant request prepares a Proposal", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "write", selectedArticleId: "one" }));
        client.streamAssistantRequest = vi.fn(async (_articleId, _input, onEvent) => {
            onEvent({ type: "completed", requestId: "proposal-request", responseKind: "proposal_prepared", messageId: "proposal-message", result: { proposal: "Improved Draft" } });
        });

        render(<App client={client} />);

        await screen.findByRole("heading", { name: "First Article" });
        await user.type(screen.getByRole("textbox", { name: "Editorial guidance" }), "Improve flow");
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        expect(await screen.findByText("Improved Draft")).toBeTruthy();
    });


    it("restores the latest completed translation from local Assistant records", async () => {
        const client = fakeClient();
        const user = userEvent.setup();
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "translations", selectedArticleId: "one" }));
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "spanish-translation-message", articleId: "one", role: "assistant", kind: "response", status: "completed", responseKind: "translation_proposal_prepared", baseRevisionId: "one-revision",
            translation: { content: "Borrador traducido", metadata: { targetLanguage: "Spanish", protectedSpans: [] } },
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
        expect(screen.getByRole("button", { name: "Edit Spanish translation" })).toBeTruthy();
    });

    // product: application.desktop-shell-layout
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
        await user.type(screen.getByRole("textbox", { name: "Editorial guidance" }), "Please help.");
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

        const libraryResize = screen.getByRole("separator", { name: message("navigation.resizeArticleLibrary") });
        const assistantResize = screen.getByRole("separator", { name: message("assistant.resize") });
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


    it("inserts a Quick action before sending an editorial request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const updateArticle = vi.fn().mockResolvedValue(undefined);

        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} translationLanguages={["Portuguese"]} assistantMessages={[{ id: "greeting", articleId: "one", role: "assistant", kind: "greeting", status: "completed", template: "greeting", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]} article={article("one", "First Article")} updateArticle={updateArticle} />);
        const panelScope = within(panel.container);

        expect(panelScope.getByText(/I’m here to help shape this Article/)).toBeTruthy();
        expect(panelScope.queryByRole("button", { name: "Talking points" })).toBeNull();

        await user.click(panelScope.getByRole("button", { name: message("assistant.quickActions") }));

        expect(panelScope.getByRole("button", { name: "Talking points" })).toBeTruthy();
        expect(panelScope.getByRole("button", { name: "Narrative draft" })).toBeTruthy();
        expect(panelScope.getByRole("button", { name: "Flow and clarity" })).toBeTruthy();
        expect(panelScope.getByRole("button", { name: "Fact checking" })).toBeTruthy();
        expect(panelScope.getByRole("button", { name: "Style review" })).toBeTruthy();
        expect(panelScope.getByRole("button", { name: "Translation" })).toBeTruthy();

        await user.type(panelScope.getByRole("textbox", { name: message("assistant.guidance") }), "Preserve the key claims.");
        await user.click(panelScope.getByRole("button", { name: message("assistant.skill.translation.label") }));
        expect(onRequest).not.toHaveBeenCalled();

        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("Preserve the key claims.", "translation", ["Portuguese"], "Preserve the key claims.".length);
    });


    it("replaces a slash trigger with a Quick action selected from the keyboard", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} article={article("one", "First Article")} updateArticle={vi.fn()} />);
        const panelScope = within(panel.container);
        const composer = panelScope.getByRole("textbox", { name: message("assistant.guidance") });

        await user.type(composer, "Keep this /");
        await user.keyboard("{ArrowDown}{Enter}");
        await user.type(composer, "focused.");

        expect(composer.textContent).toContain("Talking points focused.");
        expect(composer.textContent).not.toContain("/");
        expect(composer.textContent).toContain("Talking points");
        expect(composer.childNodes[0]?.textContent).toBe("Keep this");
        expect((composer.childNodes[1] as HTMLElement | undefined)?.dataset.assistantSkillChip).toBe("");
        expect((composer.childNodes[1] as HTMLElement | undefined)?.contentEditable).toBe("false");
        expect([...composer.childNodes].slice(2).map((node) => node.textContent).join("")).toBe(" focused.");

        await user.click(panelScope.getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("Keep this focused.", "talking_points", undefined, "Keep this".length);
    });


    it("sends the assistant request with Ctrl+Enter when configured", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} generalSettings={{ ...defaultGeneralSettings, assistantSendMode: "ctrl-enter" }} assistantMessages={[]} />);
        const composer = within(panel.container).getByRole("textbox", { name: message("assistant.guidance") });

        await user.type(composer, "Keep this focused.");
        fireEvent.keyDown(composer, { key: "Enter" });
        expect(onRequest).not.toHaveBeenCalled();

        fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });
        await waitFor(() => expect(onRequest).toHaveBeenCalledWith("Keep this focused.", undefined, undefined, undefined));
    });


    it("sends a selected skill without guidance as an Article request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} />);
        const panelScope = within(panel.container);

        await user.click(panelScope.getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(panelScope.getByRole("button", { name: message("assistant.skill.flowAndClarity.label") }));

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
        await user.click(panelScope.getByRole("button", { name: message("assistant.skill.translation.label") }));
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
        await user.click(screen.getByRole("button", { name: message("assistant.skill.translation.label") }));
        await user.click(screen.getByRole("button", { name: message("assistant.send") }));

        await waitFor(() => expect(client.streamAssistantRequest).toHaveBeenCalledTimes(2));
        expect(vi.mocked(client.streamAssistantRequest).mock.calls.map(([, request]) => request.scope.baseRevisionId)).toEqual([promoted.id, promoted.id]);
    });


    it("requests only the supported translation named in the Author guidance", () => {
        expect(requestedTranslationLanguages("German", ["es", "en"])).toEqual(["de"]);
    });


    it("summarizes an Article selection in a compact composer chip", () => {
        const selection = "The first selected sentence provides enough context to identify the excerpt.";
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} selection={selection} clearSelection={vi.fn()} />);
        const selectionChip = panel.container.querySelector<HTMLElement>("[data-assistant-composer-decoration]")!;

        expect(selectionChip.textContent).toBe("The first selected s…");
        expect(selectionChip.getAttribute("title")).toBe(selection);
        expect(within(selectionChip).getByRole("button", { name: message("assistant.clearArticleSelection") })).toBeTruthy();
    });


    it("keeps Talking points active when an Article selection becomes the priority source", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} />);
        const composer = within(panel.container).getByRole("textbox", { name: "Editorial guidance" });

        await user.type(composer, "Review this selection.");
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.quickActions") }));
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.skill.talkingPoints.label") }));
        expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeTruthy();

        panel.rerender(<IntlProvider locale="en" messages={messages}><EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} selection="Selected Article text" clearSelection={vi.fn()} /></IntlProvider>);

        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeTruthy());
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.quickActions") }));
        expect(within(panel.container).getByRole("button", { name: message("assistant.skill.narrativeDraft.label") })).toBeTruthy();
        await user.click(within(panel.container).getByRole("button", { name: message("assistant.send") }));

        expect(onRequest).toHaveBeenCalledWith("Review this selection.", "talking_points", undefined, "Review this selection.".length);
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


    it("copies Markdown by default and offers plain-text copy from the Status Bar menu", async () => {
        const user = userEvent.setup();
        const copyMarkdown = vi.fn().mockResolvedValue(true);
        const copyPlainText = vi.fn().mockResolvedValue(true);
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={vi.fn()} length={{ count: 0, remaining: 3000, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={copyMarkdown} copyPlainText={copyPlainText} />);
        const statusBarScope = within(statusBar.container);

        await user.click(statusBarScope.getByRole("button", { name: "Copy" }));
        expect(copyMarkdown).toHaveBeenCalledOnce();
        expect(statusBarScope.getByRole("button", { name: "Copied" })).toBeTruthy();

        await user.click(statusBarScope.getByLabelText("Copy options"));
        await user.click(statusBarScope.getByRole("menuitem", { name: "Copy plain text" }));
        expect(copyPlainText).toHaveBeenCalledOnce();
    });


    it("operates Status Bar menus with the keyboard and restores focus on Escape", async () => {
        const user = userEvent.setup();
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={vi.fn()} length={{ count: 0, remaining: 3000, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);
        const statusBarScope = within(statusBar.container);
        const options = statusBarScope.getByLabelText("Copy options");

        options.focus();
        await user.keyboard("{ArrowDown}");

        await waitFor(() => expect(document.activeElement).toBe(statusBarScope.getByRole("menuitem", { name: "Copy Markdown" })));
        await user.keyboard("{ArrowDown}");
        expect(document.activeElement).toBe(statusBarScope.getByRole("menuitem", { name: "Copy plain text" }));
        await user.keyboard("{Escape}");

        expect(document.activeElement).toBe(options);
        expect(statusBarScope.queryByRole("menu")).toBeNull();
    });


    it("moves the source language selector from the Article Header to the Status Bar", async () => {
        const header = renderLocalized(<ArticleHeader article={article("one", "First Article")} updateArticle={vi.fn()} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} />);
        const headerScope = within(header.container);
        const setLanguage = vi.fn().mockResolvedValue(undefined);
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={setLanguage} length={{ count: 0, remaining: 3000, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);
        const user = userEvent.setup();

        expect(headerScope.queryByRole("combobox", { name: "Source language" })).toBeNull();
        await user.click(within(statusBar.container).getByRole("button", { name: "Source language" }));
        await user.click(within(statusBar.container).getByRole("menuitemradio", { name: "Russian" }));
        expect(setLanguage).toHaveBeenCalledWith("ru");
    });


    it("updates the publishing profile from the Status Bar without saving a Revision", async () => {
        const user = userEvent.setup();
        const setProfile = vi.fn().mockResolvedValue(undefined);
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={vi.fn()} length={{ count: 0, remaining: 3000, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[{ id: "custom-123e4567-e89b-12d3-a456-426614174000", name: "Newsletter", characterLimit: 1200 }]} setProfile={setProfile} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);

        await user.click(within(statusBar.container).getByRole("button", { name: /Character count:/ }));
        expect(within(statusBar.container).getByRole("menuitemradio", { name: /Newsletter/ })).toBeTruthy();
        await user.click(within(statusBar.container).getByRole("menuitemradio", { name: /LinkedIn article/ }));

        expect(setProfile).toHaveBeenCalledWith("linkedin-article");
    });


    it("renames an Article from its header when editing finishes", async () => {
        const user = userEvent.setup();
        const updateArticle = vi.fn().mockResolvedValue(undefined);
        const header = renderLocalized(<ArticleHeader article={article("one", "Untitled article")} updateArticle={updateArticle} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} />);
        const headerScope = within(header.container);

        await user.click(headerScope.getByRole("button", { name: "Rename article: Untitled article" }));
        await user.clear(headerScope.getByRole("textbox", { name: "Article title" }));
        await user.type(headerScope.getByRole("textbox", { name: "Article title" }), "A better title");
        await user.tab();

        expect(updateArticle).toHaveBeenCalledWith("one", { title: "A better title" });
    });


    it("keeps the Article title field focused when its autosave updates the current Article", async () => {
        const user = userEvent.setup();
        const updateArticle = vi.fn().mockResolvedValue(undefined);
        const header = renderLocalized(<ArticleHeader article={article("one", "Untitled article")} updateArticle={updateArticle} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} />);
        const headerScope = within(header.container);

        await user.click(headerScope.getByRole("button", { name: "Rename article: Untitled article" }));
        const titleField = headerScope.getByRole("textbox", { name: "Article title" });
        await user.clear(titleField);
        await user.type(titleField, "A better title");
        header.rerender(<IntlProvider locale="en" messages={messages}><ArticleHeader article={article("one", "A better title")} updateArticle={updateArticle} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} /></IntlProvider>);

        expect(document.activeElement).toBe(headerScope.getByRole("textbox", { name: "Article title" }));
    });


    it("requires confirmation before deleting an Article", async () => {
        const user = userEvent.setup();
        const remove = vi.fn().mockResolvedValue(undefined);
        const header = renderLocalized(<ArticleHeader article={article("one", "First Article")} updateArticle={vi.fn()} save={vi.fn()} remove={remove} focusMode={false} setFocusMode={vi.fn()} />);
        const headerScope = within(header.container);

        await user.click(headerScope.getByRole("button", { name: "Delete article" }));

        expect(remove).not.toHaveBeenCalled();
        expect(headerScope.getByRole("heading", { name: "Delete Article?" })).toBeTruthy();
        expect(headerScope.getByText(/^Delete “First Article”/)).toBeTruthy();

        await user.click(headerScope.getByRole("button", { name: "Delete Article" }));

        expect(remove).toHaveBeenCalledWith("one");
    });


    it("shows a sequential revision number and character count in the Article Status Bar", () => {
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={2} language="en" setLanguage={vi.fn()} length={{ count: 1234, remaining: 1766, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);
        const statusBarScope = within(statusBar.container);

        expect(statusBarScope.getByText("v2")).toBeTruthy();
        expect(statusBarScope.getByText(/1,234 \/ 3,000 characters/)).toBeTruthy();
        expect(statusBarScope.queryByText(/1,766 characters remaining/)).toBeNull();
    });


    it("shows the available update control after the Article language", async () => {
        window.skladnoUpdates = {
            getState: vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1", title: "Preview", summary: "", releaseNotesUrl: "https://example.test/release", security: false, automaticChecks: true, includePrereleases: true, networkAccess: true }),
            setNetworkAccess: vi.fn(), setAutomaticChecks: vi.fn(), setIncludePrereleases: vi.fn(), checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        };
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={vi.fn()} length={{ count: 0, remaining: 3000, state: "within-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);
        const update = await within(statusBar.container).findByRole("button", { name: "Update 0.1.1-preview.1 is available" });
        const language = within(statusBar.container).getByRole("button", { name: "Source language" });

        expect(language.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });


    it("shows an overflow state in the Article Status Bar without disabling its profile selector", () => {
        const statusBar = renderLocalized(<ArticleStatusBar revisionNumber={1} language="en" setLanguage={vi.fn()} length={{ count: 3001, remaining: -1, state: "over-limit" }} profile={publishLimitProfiles[1]!} customProfiles={[]} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />);
        const statusBarScope = within(statusBar.container);

        expect(statusBarScope.getByRole("button", { name: /Character count: 3,001 of 3,000 characters/ })).toBeTruthy();
    });
});
