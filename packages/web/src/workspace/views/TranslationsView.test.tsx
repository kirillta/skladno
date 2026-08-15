import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { Article } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { TranslationsView } from "./TranslationsView.js";

// product: history-and-publishing.translation-stale-source

const article: Article = {
    id: "article-1",
    title: "Source",
    language: "en",
    currentRevisionId: "revision-2",
    currentRevision: {
        id: "revision-2",
        articleId: "article-1",
        content: "Source Article",
        provenance: { kind: "initial" },
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};


describe("TranslationsView", () => {
    afterEach(cleanup);

    it("starts translation from the workspace without inventing a target language", async () => {
        const user = userEvent.setup();
        const translate = vi.fn();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={{ ...article, language: "ru" }} translation={undefined} stale={false} create={vi.fn()} translate={translate} translationLanguages={["es"]} />
        </IntlProvider>);

        expect(screen.queryByText(/ru source/)).toBeNull();
        await user.click(screen.getByRole("button", { name: "Translate" }));
        expect(translate).toHaveBeenCalledOnce();
    });

    it("workspace.translations.stale-source blocks creating a translation from stale source content", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translation={{ targetLanguage: "Spanish", protectedSpans: [] }} stale create={vi.fn()} translate={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("The source Article has changed since this translation proposal was made.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Create translation article (Spanish)" }).hasAttribute("disabled")).toBe(true);
    });

    it("shows loading while creating a translation", async () => {
        const user = userEvent.setup();
        let resolveCreate: (() => void) | undefined;
        const create = vi.fn(() => new Promise<void>((resolve) => {
            resolveCreate = resolve;
        }));
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translation={{ targetLanguage: "Spanish", protectedSpans: [] }} stale={false} create={create} translate={vi.fn()} />
        </IntlProvider>);

        const button = screen.getByRole("button", { name: "Create translation article (Spanish)" });
        await user.click(button);

        expect(button.getAttribute("aria-busy")).toBe("true");
        expect((button as HTMLButtonElement).disabled).toBe(true);
        resolveCreate?.();
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });
});
