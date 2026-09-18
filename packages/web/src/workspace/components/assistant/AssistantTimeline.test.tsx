import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { defaultGeneralSettings, type AssistantCapabilityActivity, type AssistantMessage, type FactCheckClaimPreview, type GeneralSettings } from "@skladno/shared";
import { messages } from "../../../i18n/messages.js";
import { getMessage } from "../../../i18n/test-message.js";
import { AssistantTimeline as RenderAssistantTimeline } from "./AssistantTimeline.js";


function AssistantTimeline({ state, message, errorDetails, activity, factCheckClaims, collapsed, assistantMessages, streamedMessage, openView, onRetry, generalSettings, elapsedDuration, hasUnavailableAiConnection, openSettings }: {
    state: "idle" | "streaming" | "error";
    message: string;
    errorDetails?: string;
    activity?: AssistantCapabilityActivity;
    factCheckClaims?: FactCheckClaimPreview[];
    collapsed: boolean;
    assistantMessages?: AssistantMessage[];
    streamedMessage?: Parameters<typeof RenderAssistantTimeline>[0]["data"]["streamedMessage"];
    openView?: Parameters<typeof RenderAssistantTimeline>[0]["actions"]["openView"];
    onRetry?: Parameters<typeof RenderAssistantTimeline>[0]["actions"]["onRetry"];
    generalSettings: GeneralSettings;
    elapsedDuration: string;
    hasUnavailableAiConnection?: boolean;
    openSettings?: () => void;
}) {
    return <RenderAssistantTimeline data={{ state, message, errorDetails, activity, factCheckClaims, collapsed, assistantMessages, streamedMessage, generalSettings, elapsedDuration, hasUnavailableAiConnection }} actions={{ openView, onRetry, openSettings }} />;
}


describe("AssistantTimeline", () => {
    it("keeps conversation text selectable with the default cursor", () => {
        const view = render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
        const timeline = view.container.querySelector<HTMLElement>("[aria-live='polite']")!;

        expect(timeline.classList.contains("select-text")).toBe(true);
        expect(timeline.classList.contains("cursor-default")).toBe(true);
    });


    it("leaves Up and Down to the scroll region and moves actionable results with Left and Right", () => {
        const assistantMessages = [
            { id: "proposal", articleId: "article", role: "assistant" as const, kind: "response" as const, status: "completed" as const, responseKind: "proposal_prepared" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        ];
        const view = render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={assistantMessages} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
        const timeline = view.container.querySelector<HTMLElement>("[aria-live='polite']")!;
        timeline.focus();

        expect(fireEvent.keyDown(timeline, { key: "ArrowDown" })).toBe(true);
        fireEvent.keyDown(timeline, { key: "ArrowRight" });
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Review Proposal" }));
    });


    it("shows persisted Fact Check claims in their Findings prepared message", () => {
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[{ id: "findings", articleId: "article", role: "assistant", kind: "response", status: "completed", responseKind: "findings_prepared", createdAt: "2026-08-13T20:30:00.000Z", updatedAt: "2026-08-13T20:30:00.000Z" }]} factCheckClaims={[{ claim: "HTTP was standardized in 1999.", checked: true }]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

        expect(screen.getByRole("region", { name: getMessage("assistant.factCheckClaimsChecked") })).toBeTruthy();
        expect(screen.getByText("HTTP was standardized in 1999.")).toBeTruthy();
    });


    it("keeps human-readable activity secondary while a request streams", () => {
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="streaming" message="" activity={{ summary: "Checking facts.", status: "started" }} collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

        expect(screen.getByRole("status").textContent).toContain("Checking facts.");
        expect(screen.queryByText("Working for 1 second")).toBeNull();
    });


    it("offers scrolling to the end when the timeline is away from it", async () => {
        const user = userEvent.setup();
        const view = render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
        const timeline = view.container.querySelector<HTMLElement>("[aria-live='polite']")!;
        Object.defineProperties(timeline, {
            clientHeight: { configurable: true, value: 200 },
            scrollHeight: { configurable: true, value: 500 },
            scrollTop: { configurable: true, writable: true, value: 0 },
        });

        fireEvent.scroll(timeline);
        await user.click(screen.getByRole("button", { name: "Scroll to end" }));

        expect(timeline.scrollTop).toBe(500);
        expect(screen.queryByRole("button", { name: "Scroll to end" })).toBeNull();
    });


    it("scrolls to persisted messages loaded after the timeline mounts", () => {
        const frames: FrameRequestCallback[] = [];
        const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
        });
        let scrollHeight = 100;
        const persistedMessage = { id: "persisted", articleId: "article", role: "assistant" as const, kind: "response" as const, status: "completed" as const, content: "Persisted response.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
        try {
            const view = render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
            const timeline = view.container.querySelector<HTMLElement>("[aria-live='polite']")!;
            Object.defineProperty(timeline, "scrollHeight", { configurable: true, get: () => scrollHeight });

            view.rerender(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[persistedMessage]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

            scrollHeight = 500;
            expect(frames).toHaveLength(1);
            frames[0]?.(0);
            expect(frames).toHaveLength(2);
            frames[1]?.(0);
            expect(timeline.scrollTop).toBe(500);
        } finally {
            requestFrame.mockRestore();
        }
    });


    it("scrolls to the rendered completion when focus is outside the Assistant", () => {
        const frames: FrameRequestCallback[] = [];
        const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
        });
        const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
        let scrollHeight = 100;
        const message = { id: "response", articleId: "article", role: "assistant" as const, kind: "response" as const, status: "completed" as const, content: "Completed response.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

        try {
            const view = render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="streaming" message="" collapsed={false} assistantMessages={[]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
            const timeline = view.container.querySelector<HTMLElement>("[aria-live='polite']")!;
            Object.defineProperty(timeline, "scrollHeight", { configurable: true, get: () => scrollHeight });
            view.rerender(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[message]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);

            expect(frames).toHaveLength(1);
            view.rerender(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="idle" message="" collapsed={false} assistantMessages={[message]} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" /></IntlProvider>);
            expect(cancelFrame).not.toHaveBeenCalled();
            frames[0]?.(0);
            expect(frames).toHaveLength(2);
            scrollHeight = 500;
            frames[1]?.(0);
            expect(timeline.scrollTop).toBe(500);
        } finally {
            requestFrame.mockRestore();
            cancelFrame.mockRestore();
        }
    });


    it("offers Application Settings only for an unavailable AI connection", async () => {
        const user = userEvent.setup();
        const openSettings = vi.fn();
        render(<IntlProvider locale="en" messages={messages}><AssistantTimeline state="error" message="Couldn’t complete this editorial request." collapsed={false} generalSettings={defaultGeneralSettings} elapsedDuration="1 second" hasUnavailableAiConnection openSettings={openSettings} /></IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Open Application Settings" }));

        expect(openSettings).toHaveBeenCalledOnce();
    });
});
