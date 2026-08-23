import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { publishLimitProfiles, type Article } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { message } from "../../i18n/test-message.js";
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
            <TranslationsView article={{ ...article, language: "ru" }} stale={false} create={vi.fn()} translate={translate} translationLanguages={["es", "de"]} />
        </IntlProvider>);

        expect(screen.getByText("Use Translate to request translations. Completed proposals appear here for review.")).toBeTruthy();
        expect(screen.queryByText(/ru source/)).toBeNull();
        await user.click(screen.getByRole("button", { name: message("views.translate") }));
        expect(translate).toHaveBeenCalledOnce();
    });

    it("workspace.translations.stale-source blocks creating a translation from stale source content", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[{ metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "Borrador traducido", baseRevisionId: "revision-1" }]} stale create={vi.fn()} translate={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("The source Article has changed since this translation proposal was made.")).toBeTruthy();
        expect(screen.getByRole("button", { name: message("views.editTranslationLanguage", { language: "Spanish" }) }).hasAttribute("disabled")).toBe(true);
    });

    it("warns and blocks creation when protected content changed", () => {
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[{ metadata: { targetLanguage: "Spanish", protectedSpans: ["https://example.com", "API-v2"] }, content: "Texto sin los valores protegidos.", baseRevisionId: "revision-2" }]} stale={false} create={vi.fn()} translate={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByRole("alert").textContent).toBe("Protected content changed or missing: https://example.com, API-v2");
        expect(screen.getByRole("button", { name: message("views.editTranslationLanguage", { language: "Spanish" }) }).hasAttribute("disabled")).toBe(true);
    });

    it("shows loading while creating a translation", async () => {
        const user = userEvent.setup();
        let resolveCreate: (() => void) | undefined;
        const create = vi.fn(() => new Promise<void>((resolve) => {
            resolveCreate = resolve;
        }));
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[{ metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "Borrador traducido", baseRevisionId: "revision-2" }]} stale={false} create={create} translate={vi.fn()} />
        </IntlProvider>);

        const button = screen.getByRole("button", { name: message("views.editTranslationLanguage", { language: "Spanish" }) });
        await user.click(button);

        expect(button.getAttribute("aria-busy")).toBe("true");
        expect((button as HTMLButtonElement).disabled).toBe(true);
        resolveCreate?.();
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });

    it("opens a newly created translation in the existing Article editor", async () => {
        const user = userEvent.setup();
        const edit = vi.fn();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[{ metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "Borrador traducido", baseRevisionId: "revision-2" }]} stale={false} create={vi.fn().mockResolvedValue(undefined)} edit={edit} translate={vi.fn()} />
        </IntlProvider>);

        await user.click(screen.getByRole("button", { name: message("views.editTranslationLanguage", { language: "Spanish" }) }));
        expect(edit).toHaveBeenCalledOnce();
    });

    it("names and opens the linked source while showing its Revision number and full target language", async () => {
        const user = userEvent.setup();
        const edit = vi.fn();
        const openArticle = vi.fn();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={{ ...article, language: "en", sourceArticleId: "source-article", sourceRevisionId: "source-revision", sourceRevisionNumber: 2 }} sourceArticle={{ ...article, id: "source-article", title: "Original Article" }} stale={false} create={vi.fn()} edit={edit} openArticle={openArticle} translate={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "This translation is linked to Original Article at source Revision 2.")).toBeTruthy();
        expect(screen.getAllByText("English translation")).toHaveLength(2);
        await user.click(screen.getByRole("button", { name: message("views.translationOriginal") + " Article" }));
        expect(openArticle).toHaveBeenCalledWith("source-article");
        await user.click(screen.getByRole("button", { name: message("views.editTranslation") }));
        expect(edit).toHaveBeenCalledOnce();
    });

    it("opens standalone translations from their source Article", async () => {
        const user = userEvent.setup();
        const openArticle = vi.fn();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} linkedTranslations={[{ ...article, id: "spanish-article", title: "Source — Spanish", language: "es", sourceArticleId: article.id, sourceRevisionId: article.currentRevisionId, sourceRevisionNumber: 1 }]} stale={false} create={vi.fn()} openArticle={openArticle} translate={vi.fn()} />
        </IntlProvider>);

        await user.click(screen.getByRole("button", { name: "Spanish: Source — Spanish" }));
        expect(openArticle).toHaveBeenCalledWith("spanish-article");
    });

    it("lets the author navigate every completed target language", async () => {
        const user = userEvent.setup();
        const create = vi.fn().mockResolvedValue(undefined);
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[
                { metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "Texto en español", baseRevisionId: "revision-2" },
                { metadata: { targetLanguage: "German", protectedSpans: [] }, content: "Deutscher Text", baseRevisionId: "revision-2" },
            ]} stale={false} create={create} translate={vi.fn()} />
        </IntlProvider>);

        expect(screen.getByText("Deutscher Text")).toBeTruthy();
        await user.click(screen.getByRole("tab", { name: "Spanish" }));
        expect(screen.getByText("Texto en español")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: message("views.editTranslationLanguage", { language: "Spanish" }) }));
        expect(create).toHaveBeenCalledWith("Spanish");
    });

    it("shows selected-profile character guidance for the selected translation", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={article} translations={[
                { metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "a".repeat(3_001), baseRevisionId: "revision-2" },
                { metadata: { targetLanguage: "German", protectedSpans: [] }, content: "Kurz", baseRevisionId: "revision-2" },
            ]} stale={false} create={vi.fn()} translate={vi.fn()} publishProfile={publishLimitProfiles[2]!} publishProfileLabel="LinkedIn post" />
        </IntlProvider>);

        expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "LinkedIn post guidance · 4 characters / 3,000 · 2,996 characters remaining (guidance)")).toBeTruthy();
        await user.click(screen.getByRole("tab", { name: "Spanish" }));
        expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "LinkedIn post guidance · 3,001 characters / 3,000 · 1 characters over guidance")).toBeTruthy();
    });

    it("aligns source and translated paragraphs by order", async () => {
        const user = userEvent.setup();
        render(<IntlProvider locale="en" messages={messages}>
            <TranslationsView article={{ ...article, currentRevision: { ...article.currentRevision, content: "1. First source paragraph.\n2. Second source paragraph." } }} translations={[{ metadata: { targetLanguage: "Spanish", protectedSpans: [] }, content: "1. Primer párrafo traducido.\n2. Segundo párrafo traducido.", baseRevisionId: "revision-2" }]} stale={false} create={vi.fn()} translate={vi.fn()} />
        </IntlProvider>);

        await user.click(screen.getByRole("button", { name: message("views.translationAligned") }));

        expect(screen.getByRole("button", { name: message("views.translationAligned") }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText("1. First source paragraph.")).toBeTruthy();
        expect(screen.getByText("1. Primer párrafo traducido.")).toBeTruthy();
        const sourceSecond = screen.getByText("2. Second source paragraph.");
        const translatedSecond = screen.getByText("2. Segundo párrafo traducido.");
        expect(sourceSecond.parentElement).toBe(translatedSecond.parentElement);
    });
});
