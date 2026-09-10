import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantEvent } from "@skladno/shared";

import { App } from "../App.js";
import { message } from "../i18n/test-message.js";
import { article, fakeClient, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";

describe("Editorial Workspace assistant", () => {
    afterEach(resetWorkspaceTestEnvironment);

    // Product scenarios: editorial-workflows.assistant-streaming-block-handoff, workspace.proposal.accepted-restart
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
        expect(await screen.findByRole("article", { name: "Talking points" })).toBeTruthy();

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
        const user = userEvent.setup();
        const telemetry = { getTelemetryConsent: vi.fn(), setTelemetryConsent: vi.fn(), beginTelemetryCapture: vi.fn().mockResolvedValue(7), captureTelemetry: vi.fn().mockResolvedValue(undefined) };
        window.skladnoTelemetry = telemetry;
        client.acceptProposal = vi.fn().mockResolvedValue({
            id: "accepted-revision",
            articleId: "one",
            content: "Improved Draft",
            createdAt: "2026-01-01T00:01:00.000Z",
            provenance: {},
        });
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "proposal", selectedArticleId: "one" }));
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "proposal-message",
            articleId: "one",
            requestId: "proposal-request",
            role: "assistant",
            kind: "response",
            status: "completed",
            responseKind: "proposal_prepared",
            editorialArtifactId: "proposal-artifact",
            baseRevisionId: "one-revision",
            baseRevisionContent: "Draft",
            proposalContent: "Improved Draft",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]);

        render(<App client={client} />);

        expect(await screen.findByText("Replacement · Change 1 of 1")).toBeTruthy();
        expect(screen.getByText("Improved Draft")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("views.acceptAll") }));

        await waitFor(() => expect(client.acceptProposal).toHaveBeenCalledWith("one", {
            baseRevisionId: "one-revision",
            content: "Improved Draft",
            provenance: { kind: "accepted-proposal", baseRevisionId: "one-revision", editorialArtifactId: "proposal-artifact", wholeProposal: true },
        }));
        await waitFor(() => expect(telemetry.captureTelemetry).toHaveBeenCalledWith({ kind: "proposal_reviewed", decision: "accepted" }, 7));
        expect(await screen.findByText("This proposal was accepted. Its decisions are read-only.")).toBeTruthy();
    });


    // Product scenarios: workspace.proposal.accepted-restart
    it("restores an accepted Proposal as accepted after restart", async () => {
        const client = fakeClient();
        const accepted = article("one", "First Article");
        accepted.currentRevisionId = "accepted-revision";
        accepted.currentRevision = {
            id: accepted.currentRevisionId,
            articleId: accepted.id,
            content: "Improved first\nAnchor\nSecond",
            createdAt: "2026-01-01T00:01:00.000Z",
            provenance: { kind: "accepted-proposal", baseRevisionId: "one-revision", acceptedChangeIds: ["change-1"] },
        };
        client.listArticles = vi.fn().mockResolvedValue([accepted]);
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "proposal-message",
            articleId: accepted.id,
            requestId: "proposal-request",
            role: "assistant",
            kind: "response",
            status: "completed",
            responseKind: "proposal_prepared",
            editorialArtifactId: "proposal-artifact",
            baseRevisionId: "one-revision",
            baseRevisionContent: "First\nAnchor\nSecond",
            proposalContent: "Improved first\nAnchor\nImproved second",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]);
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "proposal", selectedArticleId: accepted.id }));

        render(<App client={client} />);

        expect(await screen.findByText("This proposal was accepted. Its decisions are read-only.")).toBeTruthy();
        expect(screen.queryByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.")).toBeNull();
        expect(screen.getByText("Accepted")).toBeTruthy();
        expect(screen.getByText("Rejected")).toBeTruthy();
        expect(screen.getByRole("button", { name: message("views.acceptAll") }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("tab", { name: message("workspace.tabs.proposal") })).toBeTruthy();
    });


    it("keeps an unaccepted Proposal stale when a different Proposal changed the Revision", async () => {
        const client = fakeClient();
        const articleWithDifferentAcceptance = article("one", "First Article");
        articleWithDifferentAcceptance.currentRevisionId = "accepted-revision";
        articleWithDifferentAcceptance.currentRevision = {
            id: articleWithDifferentAcceptance.currentRevisionId,
            articleId: articleWithDifferentAcceptance.id,
            content: "Different accepted Proposal",
            createdAt: "2026-01-01T00:01:00.000Z",
            provenance: { kind: "accepted-proposal", baseRevisionId: "one-revision", editorialArtifactId: "other-proposal-artifact", wholeProposal: true },
        };
        client.listArticles = vi.fn().mockResolvedValue([articleWithDifferentAcceptance]);
        client.listAssistantMessages = vi.fn().mockResolvedValue([{
            id: "proposal-message",
            articleId: articleWithDifferentAcceptance.id,
            requestId: "proposal-request",
            role: "assistant",
            kind: "response",
            status: "completed",
            responseKind: "proposal_prepared",
            editorialArtifactId: "proposal-artifact",
            baseRevisionId: "one-revision",
            baseRevisionContent: "Draft",
            proposalContent: "Improved Draft",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        }]);
        localStorage.setItem("skladno-workspace-layout", JSON.stringify({ version: 3, libraryWidth: 208, assistantWidth: 384, libraryCollapsed: false, assistantCollapsed: false, proposalWarningsDismissed: false, view: "proposal", selectedArticleId: articleWithDifferentAcceptance.id }));

        render(<App client={client} />);

        expect(await screen.findByText("This proposal is stale because the article has a newer revision. Generate a new proposal before accepting changes.")).toBeTruthy();
        expect(screen.queryByText("This proposal was accepted. Its decisions are read-only.")).toBeNull();
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


});
