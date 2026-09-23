import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings } from "@skladno/shared";

import { App } from "../App.js";
import { getMessage } from "../i18n/test-message.js";
import { createArticleFixture, createFakeClient, renderLocalized, resetWorkspaceTestEnvironment, TestEditorialAssistantPanel as EditorialAssistantPanel } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: workspace.assistant.quick-action

describe("Editorial Assistant composer", () => {
    afterEach(resetWorkspaceTestEnvironment);

    it("inserts a Quick action before sending an editorial request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const updateArticle = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} translationLanguages={["Portuguese"]} assistantMessages={[{ id: "greeting", articleId: "one", role: "assistant", kind: "greeting", status: "completed", template: "greeting", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]} article={createArticleFixture("one", "First Article")} updateArticle={updateArticle} />);
        const panelScope = within(panel.container);

        expect(panelScope.getByText(/here to help shape this Article/)).toBeTruthy();
        expect(panelScope.queryByRole("button", { name: "Talking points" })).toBeNull();

        const quickActions = panelScope.getByRole("button", { name: getMessage("assistant.quickActions") });
        expect(quickActions.getAttribute("aria-haspopup")).toBe("listbox");
        expect(quickActions.querySelector("svg")?.classList.contains("transition-transform")).toBe(true);
        await user.click(quickActions);

        expect(panelScope.getByRole("option", { name: "Talking points" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Narrative draft" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Flow and clarity" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Fact checking" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Style review" })).toBeTruthy();
        expect(panelScope.getByRole("option", { name: "Translation" })).toBeTruthy();

        await user.click(panelScope.getByRole("option", { name: getMessage("assistant.skill.translation.label") }));
        expect(onRequest).not.toHaveBeenCalled();
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.send") }));
        expect(onRequest).toHaveBeenCalledWith("", "translation", ["Portuguese"], 0);
    });

    it("selects a Quick action", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} article={createArticleFixture("one", "First Article")} updateArticle={vi.fn()} />);
        const panelScope = within(panel.container);
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: getMessage("assistant.skill.narrativeDraft.label") }));
        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")?.textContent).toContain("Narrative draft"));
        const composer = panelScope.getByRole("combobox", { name: getMessage("assistant.guidance") });
        expect(composer.textContent).toBe("Narrative draft ");
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.send") }));
        expect(onRequest).toHaveBeenCalledWith("", "narrative_draft", undefined, 0);
    });

    it("shows built-in Skills by default", async () => {
        const user = userEvent.setup();
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} assistantMessages={[]} authorSkills={[{ reference: { source: "author", id: "house-style", version: "1" }, name: "House style", description: "Apply the Author's preferred house style." }]} />);
        const panelScope = within(panel.container);

        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.quickActions") }));
        expect(panelScope.getByRole("option", { name: "Skill Creator" })).toBeTruthy();
        expect(panelScope.queryByRole("option", { name: "House style" })).toBeNull();
    });

    it("undoes composer edits with Ctrl+Z", async () => {
        const user = userEvent.setup();
        const execute = vi.fn();
        window.skladnoShell = { execute };
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        render(<App client={createFakeClient()} />);
        const composer = await screen.findByRole("combobox", { name: getMessage("assistant.guidance") });
        await user.type(composer, "Draft guidance");
        await user.keyboard("{Control>}z{/Control}");
        await waitFor(() => expect(composer.textContent).toBe(""));
        expect(execute).not.toHaveBeenCalledWith("undo");
    });

    it("keeps native copy and paste shortcuts in the composer", async () => {
        const execute = vi.fn();
        window.skladnoShell = { execute };
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
        render(<App client={createFakeClient()} />);
        const composer = await screen.findByRole("combobox", { name: getMessage("assistant.guidance") });
        composer.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true }));
        composer.dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true }));
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
        const composer = within(panel.container).getByRole("combobox", { name: getMessage("assistant.guidance") });
        const articleControl = document.createElement("button");
        panel.container.append(articleControl);
        await user.type(composer, "Review this");
        await user.click(within(panel.container).getByRole("button", { name: getMessage("assistant.send") }));
        articleControl.focus();
        finishRequest?.();
        await waitFor(() => expect(composer.textContent).toBe(""));
        expect(document.activeElement).toBe(articleControl);
    });

    it("clears the composer while an Assistant response streams", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn(() => new Promise<void>(() => undefined));
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} assistantMessages={[]} />);
        const panelScope = within(panel.container);
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: getMessage("assistant.skill.talkingPoints.label") }));
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.send") }));
        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeNull());
    });

    it("sends the assistant request with Ctrl+Enter when configured", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn(() => new Promise<void>(() => undefined));
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} generalSettings={{ ...defaultGeneralSettings, assistantSendMode: "ctrl-enter" }} assistantMessages={[]} />);
        const composer = within(panel.container).getByRole("combobox", { name: getMessage("assistant.guidance") });
        await user.click(within(panel.container).getByRole("button", { name: getMessage("assistant.quickActions") }));
        await user.click(within(panel.container).getByRole("option", { name: getMessage("assistant.skill.talkingPoints.label") }));
        fireEvent.keyDown(composer, { key: "Enter" });
        expect(onRequest).not.toHaveBeenCalled();
        fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });
        await waitFor(() => expect(onRequest).toHaveBeenCalledWith("", "talking_points", undefined, 0));
        await waitFor(() => expect(panel.container.querySelector("[data-assistant-skill-chip]")).toBeNull());
    });

    it("sends a selected skill without guidance as an Article request", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" assistantMessages={[]} />);
        const panelScope = within(panel.container);
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: getMessage("assistant.skill.flowAndClarity.label") }));
        expect(panelScope.getByRole("button", { name: getMessage("assistant.send") }).hasAttribute("disabled")).toBe(false);
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.send") }));
        expect(onRequest).toHaveBeenCalledWith("", "flow_and_clarity", undefined, 0);
    });

    it("creates a translation proposal for every configured default language", async () => {
        const user = userEvent.setup();
        const onRequest = vi.fn().mockResolvedValue(undefined);
        const panel = renderLocalized(<EditorialAssistantPanel state="idle" message="" onRequest={onRequest} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="Portuguese" translationLanguages={["Spanish", "German"]} assistantMessages={[]} />);
        const panelScope = within(panel.container);
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.quickActions") }));
        await user.click(panelScope.getByRole("option", { name: getMessage("assistant.skill.translation.label") }));
        await user.click(panelScope.getByRole("button", { name: getMessage("assistant.send") }));
        expect(onRequest).toHaveBeenCalledWith("", "translation", ["Spanish", "German"], 0);
    });
});
