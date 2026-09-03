import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishLimitProfiles } from "@skladno/shared";

import { ArticleHeader } from "./components/ArticleHeader.js";
import { ArticleStatusBar } from "./components/ArticleStatusBar.js";
import { messages } from "../i18n/messages.js";
import { article, renderLocalized, resetWorkspaceTestEnvironment } from "./EditorialWorkspace.test-utils.js";


// Product scenarios: workspace.header.metadata-and-deletion, workspace.publishing.over-guidance, history-and-publishing.publishing-guidance

describe("Editorial Workspace article controls", () => {
    afterEach(resetWorkspaceTestEnvironment);

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
