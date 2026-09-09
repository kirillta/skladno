import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings } from "@skladno/shared";

import { App } from "../App.js";
import { messages } from "../i18n/messages.js";
import { message } from "../i18n/test-message.js";
import { EditorialAssistantPanel } from "./components/EditorialAssistantPanel.js";
import { requestedTranslationLanguages } from "./state/assistant-messages-state.js";
import { article, fakeClient, renderLocalized, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace assistant", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenarios: application.desktop-shell-layout, workspace.assistant.selection-deselection
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
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
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
            const timeline = () => panel.container.querySelector<HTMLElement>("[aria-live='polite']")!;

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
