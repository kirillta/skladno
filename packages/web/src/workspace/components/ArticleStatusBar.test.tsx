import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { expect, it, vi } from "vitest";
import { PUBLISH_LIMIT_PROFILE, publishLimitProfiles, type ArticleRevision } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";


const revisions: ArticleRevision[] = [
    { id: "revision-one", articleId: "article-one", content: "Initial text", createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } },
    { id: "revision-two", articleId: "article-one", content: "Current text", createdAt: "2026-01-02T00:00:00.000Z", provenance: { kind: "author-draft" } },
];


it("moves between status controls with Left and Right", () => {
    render(<IntlProvider locale="en" messages={messages}><ArticleStatusBar
        revisionNumber={1}
        language="en"
        setLanguage={vi.fn().mockResolvedValue(undefined)}
        saveState="saved"
        length={{ count: 100, state: "within-limit" }}
        profile={publishLimitProfiles.find((profile) => profile.id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS)!}
        customProfiles={[]}
        setProfile={vi.fn().mockResolvedValue(undefined)}
        copyMarkdown={vi.fn().mockResolvedValue(true)}
        copyPlainText={vi.fn().mockResolvedValue(true)}
    /></IntlProvider>);

    const language = screen.getByRole("button", { name: "Source language" });
    expect(language.className).toContain("focus-visible:ring-brand");
    language.focus();
    fireEvent.keyDown(language, { key: "ArrowRight" });
    const characterCount = screen.getByRole("button", { name: /Character count/ });
    expect(document.activeElement).toBe(characterCount);
    expect(characterCount.className).toContain("focus-visible:ring-brand");
});


it("closes an open menu when the Author clicks outside the Status Bar", async () => {
    const user = userEvent.setup();
    const statusBar = render(<IntlProvider locale="en" messages={messages}><ArticleStatusBar
        revisionNumber={1}
        language="en"
        setLanguage={vi.fn().mockResolvedValue(undefined)}
        saveState="saved"
        length={{ count: 100, state: "within-limit" }}
        profile={publishLimitProfiles.find((profile) => profile.id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS)!}
        customProfiles={[]}
        setProfile={vi.fn().mockResolvedValue(undefined)}
        copyMarkdown={vi.fn().mockResolvedValue(true)}
        copyPlainText={vi.fn().mockResolvedValue(true)}
    /></IntlProvider>);

    const scope = within(statusBar.container);
    await user.click(scope.getByRole("button", { name: "Source language" }));
    expect(scope.getByRole("menu", { name: "Source language" })).toBeTruthy();

    await user.click(document.body);

    expect(scope.queryByRole("menu", { name: "Source language" })).toBeNull();
});


it("lists Revisions newest first, previews a selection, and keeps restore explicit", async () => {
    const user = userEvent.setup();
    const selectForRestore = vi.fn();
    render(<IntlProvider locale="en" messages={messages}><ArticleStatusBar
        revisionNumber={2}
        revisionSelector={{ revisions, currentRevisionId: "revision-two", selectForRestore }}
        language="en"
        setLanguage={vi.fn().mockResolvedValue(undefined)}
        saveState="saved"
        length={{ count: 100, state: "within-limit" }}
        profile={publishLimitProfiles.find((profile) => profile.id === PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS)!}
        customProfiles={[]}
        setProfile={vi.fn().mockResolvedValue(undefined)}
        copyMarkdown={vi.fn().mockResolvedValue(true)}
        copyPlainText={vi.fn().mockResolvedValue(true)}
    /></IntlProvider>);

    await user.click(screen.getByRole("button", { name: /Current Revision v2/ }));
    const menu = screen.getByRole("menu", { name: "Saved Revisions" });
    const items = within(menu).getAllByRole("menuitemradio");

    expect(items[0]?.textContent).toContain("v2");
    expect(items[0]?.textContent).toContain("Current");
    expect(items[0]?.textContent).toContain("Selected");
    await user.click(items[1]!);

    expect(screen.getByRole("region", { name: "Revision 1 preview" })).toBeTruthy();
    expect(screen.getByText("Initial text")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore this revision" }));
    expect(selectForRestore).toHaveBeenCalledWith(revisions[0]);
});
