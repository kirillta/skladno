import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { expect, it, vi } from "vitest";
import { PUBLISH_LIMIT_PROFILE, publishLimitProfiles } from "@skladno/shared";
import { messages } from "../../i18n/messages.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";


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
