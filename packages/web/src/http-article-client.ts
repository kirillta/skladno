import {
    acceptProposalPath,
    articleArchivePath,
    articleDraftPath,
    articlePinPath,
    articleRevisionsPath,
    articlesPath,
    assistantMessagesPath,
    assistantRequestsPath,
    editorialPath,
    factCheckResolutionPath,
    factChecksPath,
    HTTP_METHOD,
    pinnedArticleOrderPath,
    proposalSummariesPath,
    restoreRevisionPath,
    type AcceptProposalInput,
    type Article,
    type ArticleDraft,
    type ArticleRevision,
    type AssistantEvent,
    type AssistantMessage,
    type CreateArticleInput,
    type EditorialEvent,
    type FactCheck,
    type FactCheckFinding,
    type ProposalChangeSummary,
    type SaveArticleDraftInput,
    type SaveArticleRevisionInput,
    type StartAssistantRequest,
    type StartEditorialRequest,
    type SummarizeProposalInput,
    type UpdateArticleInput,
    ApplicationClientError,
} from "@skladno/shared";

import { applicationClientError, parseAssistantEvent, streamEvents } from "./http-client-transport.js";
import { HttpSettingsClient } from "./http-settings-client.js";


export abstract class HttpArticleClient extends HttpSettingsClient {
    async listArticles(): Promise<Article[]> {
        return this.request<Article[]>(articlesPath);
    }


    async createArticle(input: CreateArticleInput): Promise<Article> {
        return this.request<Article>(articlesPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async updateArticle(articleId: string, input: UpdateArticleInput): Promise<Article> {
        return this.request<Article>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.PATCH, body: JSON.stringify(input) });
    }


    async deleteArticle(articleId: string): Promise<void> {
        await this.request<void>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.DELETE });
    }


    async setArticleArchived(articleId: string, archived: boolean): Promise<Article[]> {
        return this.request<Article[]>(articleArchivePath(articleId), { method: HTTP_METHOD.PUT, body: JSON.stringify({ archived }) });
    }


    async setArticlePinned(articleId: string, pinned: boolean): Promise<Article> {
        return this.request<Article>(articlePinPath(articleId), { method: HTTP_METHOD.PUT, body: JSON.stringify({ pinned }) });
    }


    async reorderPinnedArticles(articleIds: string[]): Promise<Article[]> {
        return this.request<Article[]>(pinnedArticleOrderPath, { method: HTTP_METHOD.PUT, body: JSON.stringify({ articleIds }) });
    }


    async saveArticleDraft(articleId: string, input: SaveArticleDraftInput): Promise<ArticleDraft> {
        return this.request<ArticleDraft>(articleDraftPath(articleId), { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async discardArticleDraft(articleId: string, expectedDraftVersion: number): Promise<void> {
        await this.request<void>(`${articleDraftPath(articleId)}?expectedDraftVersion=${expectedDraftVersion}`, { method: HTTP_METHOD.DELETE });
    }


    async saveArticleRevision(articleId: string, input: SaveArticleRevisionInput): Promise<ArticleRevision> {
        return this.request<ArticleRevision>(articleRevisionsPath(articleId), { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async listArticleRevisions(articleId: string): Promise<ArticleRevision[]> {
        return this.request<ArticleRevision[]>(articleRevisionsPath(articleId));
    }


    async acceptProposal(articleId: string, input: AcceptProposalInput): Promise<ArticleRevision> {
        return this.request<ArticleRevision>(acceptProposalPath(articleId), { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async summarizeProposal(articleId: string, input: SummarizeProposalInput): Promise<ProposalChangeSummary[]> {
        return this.request<ProposalChangeSummary[]>(proposalSummariesPath(articleId), { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async restoreRevision(articleId: string, revisionId: string): Promise<ArticleRevision> {
        return this.request<ArticleRevision>(restoreRevisionPath(articleId, revisionId), { method: HTTP_METHOD.POST });
    }


    async listAssistantMessages(articleId: string): Promise<AssistantMessage[]> {
        return this.request<AssistantMessage[]>(assistantMessagesPath(articleId));
    }


    async streamAssistantRequest(articleId: string, input: StartAssistantRequest, onEvent: (event: AssistantEvent) => void, signal?: AbortSignal): Promise<void> {
        const response = await fetch(`${this.serviceUrl}${assistantRequestsPath(articleId)}`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal,
        });
        if (!response.ok || !response.body) {
            const body: unknown = await response.json().catch(() => undefined);
            const payload = body && typeof body === "object" && "error" in body
                ? (body as { error: unknown }).error
                : undefined;

            throw applicationClientError(payload, response.status);
        }

        await streamEvents(response.body, parseAssistantEvent, (event) => {
            if (event.type === "error")
                throw new ApplicationClientError(event.errorCode, undefined, response.status);

            onEvent(event);
        });
    }


    async streamEditorial(articleId: string, input: StartEditorialRequest, onEvent: (event: EditorialEvent) => void, signal?: AbortSignal): Promise<void> {
        const response = await fetch(`${this.serviceUrl}${editorialPath(articleId)}`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal,
        });

        if (!response.ok || !response.body)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);

        await streamEvents(response.body, (data) => JSON.parse(data) as EditorialEvent, onEvent);
    }


    async listFactChecks(articleId: string): Promise<FactCheck[]> {
        return this.request<FactCheck[]>(factChecksPath(articleId));
    }


    async resolveFactCheckFinding(articleId: string, occurrenceId: string, resolution: NonNullable<FactCheckFinding["resolution"]>): Promise<void> {
        await this.request<void>(factCheckResolutionPath(articleId, occurrenceId), { method: HTTP_METHOD.PUT, body: JSON.stringify({ resolution }) });
    }
}
