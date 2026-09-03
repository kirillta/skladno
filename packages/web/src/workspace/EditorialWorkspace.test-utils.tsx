/* eslint-disable project-style/no-production-intl-provider -- This is a test-only render helper. */
import { cleanup, render } from "@testing-library/react";
import { defaultGeneralSettings, defaultPublishingSettings, type Article, type ArticleRevision } from "@skladno/shared";
import { IntlProvider } from "react-intl";
import type { ReactElement } from "react";
import { vi } from "vitest";

import type { EditorialWorkspaceClient } from "../application-client.js";
import { messages } from "../i18n/messages.js";


export function article(id: string, title: string): Article {
    const revision: ArticleRevision = { id: `${id}-revision`, articleId: id, content: "Draft", createdAt: "2026-01-01T00:00:00.000Z", provenance: { kind: "initial" } };
    return { id, title, createdAt: revision.createdAt, updatedAt: revision.createdAt, currentRevisionId: revision.id, currentRevision: revision };
}


export function renderLocalized(element: ReactElement) {
    return render(<IntlProvider locale="en" messages={messages}>{element}</IntlProvider>);
}


export function fakeClient(): EditorialWorkspaceClient {
    const created = article("new", "New Article");
    return {
        getHealth: vi.fn(), listArticles: vi.fn().mockResolvedValue([article("one", "First Article")]), createArticle: vi.fn().mockResolvedValue(created), updateArticle: vi.fn(), deleteArticle: vi.fn(), saveArticleDraft: vi.fn(), discardArticleDraft: vi.fn(), saveArticleRevision: vi.fn(), listArticleRevisions: vi.fn().mockResolvedValue([]), listAssistantMessages: vi.fn().mockResolvedValue([]), streamAssistantRequest: vi.fn(), acceptProposal: vi.fn(), summarizeProposal: vi.fn().mockResolvedValue([]), restoreRevision: vi.fn(), streamEditorial: vi.fn(), getStyleCorpus: vi.fn().mockResolvedValue({ items: [], rules: "", status: "empty" }), addStyleCorpusItem: vi.fn(), removeStyleCorpusItem: vi.fn(), setStyleCorpusItemIncluded: vi.fn(), setStyleCorpusRules: vi.fn(), rebuildStyleCorpus: vi.fn(), getArticleStyleRules: vi.fn().mockResolvedValue(""), setArticleStyleRules: vi.fn(), getPublishingSettings: vi.fn().mockResolvedValue(defaultPublishingSettings), setPublishingSettings: vi.fn(), getApplicationSettings: vi.fn().mockResolvedValue({ general: defaultGeneralSettings, connections: [], modelPreferences: { defaultModel: "", skillOverrides: {} }, backupPolicy: { schedule: "off", retention: { mode: "count", count: 7 } }, keyBindingOverrides: {} }), updateGeneralSettings: vi.fn(), updateBackupPolicy: vi.fn(), updateKeyBindingOverrides: vi.fn(), addAiConnection: vi.fn(), updateAiConnection: vi.fn(), removeAiConnection: vi.fn(), setActiveAiConnection: vi.fn(), testAiConnection: vi.fn(), refreshAiModels: vi.fn(), updateModelPreferences: vi.fn(),
    } as unknown as EditorialWorkspaceClient;
}


export function resetWorkspaceTestEnvironment() {
    cleanup();
    localStorage.clear();
    window.skladnoUpdates = undefined;
}




