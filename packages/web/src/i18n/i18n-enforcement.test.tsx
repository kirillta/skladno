import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { publishLimitProfiles, type Article, type ArticleRevision } from "@skladno/shared";

import { ArticleHeader } from "../workspace/components/ArticleHeader.js";
import { ArticleStatusBar } from "../workspace/components/ArticleStatusBar.js";
import { EditorialAssistantPanel } from "../workspace/components/EditorialAssistantPanel.js";
import { messages, type MessageId } from "./messages.js";


const pseudoMessages = Object.fromEntries(Object.entries(messages).map(([id, message]) => [id, `⟦${message}⟧`])) as Record<MessageId, string>;


function article(): Article {
    const revision: ArticleRevision = {
        id: "revision-one",
        articleId: "article-one",
        content: "Draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        provenance: {
            kind: "initial",
        },
    };

    return {
        id: "article-one",
        title: "Author title",
        createdAt: revision.createdAt,
        updatedAt: revision.createdAt,
        currentRevisionId: revision.id,
        currentRevision: revision,
    };
}


function PseudoLocaleFixture() {
    return <IntlProvider locale="en-XA" messages={pseudoMessages} onError={(error) => {
        throw error;
    }}>
        <ArticleHeader article={article()} updateArticle={vi.fn()} save={vi.fn()} remove={vi.fn()} focusMode={false} setFocusMode={vi.fn()} />
        <ArticleStatusBar revisionNumber={1} length={{ count: 12, remaining: 2988, state: "within-limit" }} profile={publishLimitProfiles[1]!} setProfile={vi.fn()} copyMarkdown={vi.fn()} copyPlainText={vi.fn()} />
        <EditorialAssistantPanel state="idle" message="" onRequest={vi.fn()} onCancel={vi.fn()} collapsed={false} setCollapsed={vi.fn()} language="es" />
    </IntlProvider>;
}


describe("i18n enforcement", () => {
    afterEach(cleanup);

    it("keeps workspace components on the application locale provider", () => {
        render(<PseudoLocaleFixture />);

        expect(screen.getByRole("button", { name: "⟦Rename article: Author title⟧" })).toBeTruthy();
        expect(screen.getByRole("contentinfo", { name: "⟦Article status⟧" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "⟦Editorial Assistant⟧" })).toBeTruthy();
    });
});
