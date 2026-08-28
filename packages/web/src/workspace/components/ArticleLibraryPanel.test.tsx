import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Article, DesktopUpdateClient } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { message } from "../../i18n/test-message.js";
import { ArticleLibraryPanel } from "./ArticleLibraryPanel.js";


const source: Article = {
    id: "source",
    title: "Mother Article",
    language: "en",
    currentRevisionId: "source-revision",
    currentRevision: { id: "source-revision", articleId: "source", content: "Source", provenance: { kind: "initial" }, createdAt: "2026-01-01T00:00:00.000Z" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};


describe("ArticleLibraryPanel", () => {
    afterEach(() => {
        cleanup();
        window.skladnoUpdates = undefined;
    });

    it("lists translation Articles beneath their source and keeps them selectable during search", async () => {
        const user = userEvent.setup();
        const selectArticle = vi.fn();
        const translation: Article = { ...source, id: "translation", title: "Spanish edition", language: "es", sourceArticleId: source.id, sourceRevisionId: source.currentRevisionId, sourceRevisionNumber: 1 };
        render(<IntlProvider locale="en" messages={messages}>
            <ArticleLibraryPanel articles={[translation, source]} selectedArticleId={source.id} selectArticle={selectArticle} collapsed={false} setCollapsed={vi.fn()} createBlank={vi.fn()} openStyleProfile={vi.fn()} openSettings={vi.fn()} language="en" saveState="saved" />
        </IntlProvider>);

        const sourceButton = screen.getByRole("button", { name: /Mother Article/ });
        const translationButton = screen.getByRole("button", { name: /Spanish edition/ });
        expect(sourceButton.compareDocumentPosition(translationButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        await user.type(screen.getByRole("textbox", { name: message("navigation.searchArticles") }), "Spanish");
        await user.click(screen.getByRole("button", { name: /Spanish edition/ }));
        expect(screen.getByRole("button", { name: /Mother Article/ })).toBeTruthy();
        expect(selectArticle).toHaveBeenCalledWith("translation");
    });


    it("shows the update control beside Settings when an update is available", async () => {
        window.skladnoUpdates = {
            getState: vi.fn().mockResolvedValue({ kind: "available", currentVersion: "0.1.0-preview.1", version: "0.1.1-preview.1", title: "Preview", summary: "", releaseNotesUrl: "https://example.test/release", security: false, automaticChecks: true, networkAccess: true }),
            setNetworkAccess: vi.fn(), setAutomaticChecks: vi.fn(), checkNow: vi.fn(), download: vi.fn(), restartAndUpdate: vi.fn(), openReleaseNotes: vi.fn(), openRecoveryGuide: vi.fn(), rendererReady: vi.fn(), subscribe: () => () => undefined,
        } satisfies DesktopUpdateClient;
        render(<IntlProvider locale="en" messages={messages}>
            <ArticleLibraryPanel articles={[]} selectedArticleId={undefined} selectArticle={vi.fn()} collapsed={false} setCollapsed={vi.fn()} createBlank={vi.fn()} openStyleProfile={vi.fn()} openSettings={vi.fn()} language="en" saveState="saved" />
        </IntlProvider>);

        expect((await screen.findByRole("button", { name: "Update 0.1.1-preview.1 is available" })).textContent).toContain(message("settings.updates"));
    });
});
