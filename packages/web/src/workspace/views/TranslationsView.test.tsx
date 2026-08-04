import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { TranslationsView } from "./TranslationsView.js";


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
    it("workspace.translations.stale-source blocks creating a translation from stale source content", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translation={{ targetLanguage: "Spanish", protectedSpans: [] }} stale create={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("The source Article has changed since this translation proposal was made.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Create translation article (Spanish)" }).hasAttribute("disabled")).toBe(true);
    });
});
