import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { type Article, type ArticleRevision } from "@skladno/shared";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { messages } from "../../i18n/messages.js";
import { NotificationProvider } from "../../notifications/NotificationProvider.js";
import { useArticleRevisions } from "./article-revisions-state.js";


function deferred<T>() {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>((setResolve) => {
        resolve = setResolve;
    });

    return { promise, resolve };
}


function article(id: string): Article {
    const revision = revisionFor(id);
    return { id, title: id, createdAt: revision.createdAt, updatedAt: revision.createdAt, currentRevisionId: revision.id, currentRevision: revision };
}


function revisionFor(articleId: string): ArticleRevision {
    return { id: `${articleId}-revision`, articleId, content: `${articleId} history`, createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } };
}


function RevisionHarness({ client, selectedArticle }: { client: EditorialWorkspaceClient; selectedArticle: Article }) {
    const { revisions } = useArticleRevisions(client, selectedArticle, vi.fn(), vi.fn(), vi.fn());
    return <output>{revisions.map((revision) => revision.content).join(", ")}</output>;
}


function renderRevisions(client: EditorialWorkspaceClient, selectedArticle: Article) {
    return render(<IntlProvider locale="en" messages={messages}><NotificationProvider><RevisionHarness client={client} selectedArticle={selectedArticle} /></NotificationProvider></IntlProvider>);
}


describe("useArticleRevisions", () => {
    afterEach(cleanup);


    it("keeps the selected Article's history when responses resolve in reverse order", async () => {
        const first = deferred<ArticleRevision[]>();
        const second = deferred<ArticleRevision[]>();
        const client = {
            listArticleRevisions: vi.fn((articleId: string) => articleId === "article-a" ? first.promise : second.promise),
        } as unknown as EditorialWorkspaceClient;
        const view = renderRevisions(client, article("article-a"));

        await waitFor(() => expect(client.listArticleRevisions).toHaveBeenCalledWith("article-a"));
        view.rerender(<IntlProvider locale="en" messages={messages}><NotificationProvider><RevisionHarness client={client} selectedArticle={article("article-b")} /></NotificationProvider></IntlProvider>);
        await waitFor(() => expect(client.listArticleRevisions).toHaveBeenCalledWith("article-b"));

        await act(async () => second.resolve([revisionFor("article-b")]));
        expect(screen.getByText("article-b history")).toBeTruthy();

        await act(async () => first.resolve([revisionFor("article-a")]));
        expect(screen.getByText("article-b history")).toBeTruthy();
        expect(screen.queryByText("article-a history")).toBeNull();
    });
});
