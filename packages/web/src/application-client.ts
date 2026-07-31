import {
    ArticleRevisionConflictError,
    acceptProposalPath,
    articlesPath,
    articleRevisionsPath,
    editorialPath,
    healthPath,
    HTTP_METHOD,
    HTTP_STATUS,
    parseHealthResponse,
    type ApplicationClient,
    type CreateArticleInput,
    type Article,
    type HealthResponse,
    type SaveArticleRevisionInput,
    type AcceptProposalInput,
    type ArticleRevision,
    type ArticleLibraryClient,
    type EditorialClient,
    type EditorialEvent,
    type StartEditorialRequest,
    restoreRevisionPath,
    styleCorpusPath,
    type CreateStyleCorpusItemInput,
    type StyleCorpus,
    type StyleCorpusClient,
    publishSettingsPath,
    type PublishLimitProfileId,
    type PublishingClient,
} from "@skladno/shared";

/** HTTP implementation of the UI's transport-neutral application boundary. */
export interface EditorialWorkspaceClient extends ApplicationClient, ArticleLibraryClient, EditorialClient, StyleCorpusClient, PublishingClient { }


export class HttpApplicationClient implements EditorialWorkspaceClient {
    constructor(private readonly serviceUrl = "http://127.0.0.1:8787") { }

    async getHealth(): Promise<HealthResponse> {
        const response = await fetch(`${this.serviceUrl}${healthPath}`);
        if (!response.ok)
            throw new Error(`The local service could not be reached (${response.status}).`);

        return parseHealthResponse(await response.json());
    }


    async listArticles(): Promise<Article[]> {
        return this.request<Article[]>(articlesPath);
    }


    async createArticle(input: CreateArticleInput): Promise<Article> {
        return this.request<Article>(articlesPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async renameArticle(articleId: string, title: string): Promise<Article> {
        return this.request<Article>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.PATCH, body: JSON.stringify({ title }) });
    }


    async deleteArticle(articleId: string): Promise<void> {
        await this.request<void>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.DELETE });
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


    async restoreRevision(articleId: string, revisionId: string): Promise<ArticleRevision> {
        return this.request<ArticleRevision>(restoreRevisionPath(articleId, revisionId), { method: HTTP_METHOD.POST });
    }


    async getStyleCorpus(): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath);
    }


    async addStyleCorpusItem(input: CreateStyleCorpusItemInput): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async removeStyleCorpusItem(materialId: string): Promise<void> {
        await this.request<void>(`${styleCorpusPath}/${encodeURIComponent(materialId)}`, { method: HTTP_METHOD.DELETE });
    }


    async getPublishLimitProfile(): Promise<PublishLimitProfileId> {
        const response = await this.request<{ profileId: PublishLimitProfileId }>(publishSettingsPath);
        return response.profileId;
    }


    async setPublishLimitProfile(profileId: PublishLimitProfileId): Promise<PublishLimitProfileId> {
        const response = await this.request<{ profileId: PublishLimitProfileId }>(publishSettingsPath, {
            method: HTTP_METHOD.PUT,
            body: JSON.stringify({ profileId }),
        });
        return response.profileId;
    }


    async streamEditorial(articleId: string, input: StartEditorialRequest, onEvent: (event: EditorialEvent) => void, signal?: AbortSignal): Promise<void> {
        const response = await fetch(`${this.serviceUrl}${editorialPath(articleId)}`, {
            method: HTTP_METHOD.POST,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal,
        });

        if (!response.ok || !response.body)
            throw new Error(`The editorial service could not be reached (${response.status}).`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });

            const messages = buffer.split("\n\n");
            buffer = messages.pop() ?? "";

            for (const message of messages) {
                const data = message.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
                if (!data)
                    continue;

                onEvent(JSON.parse(data) as EditorialEvent);
            }

            if (done)
                return;
        }
    }


    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        const response = await fetch(`${this.serviceUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
        if (response.status === HTTP_STATUS.NO_CONTENT)
            return undefined as T;

        const body: unknown = await response.json().catch(() => ({}));
        if (response.status === HTTP_STATUS.CONFLICT && typeof body === "object" && body !== null && "article" in body)
            throw new ArticleRevisionConflictError((body as { article: Article }).article);

        if (!response.ok) {
            const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
                ? body.error
                : `The local service could not be reached (${response.status}).`;

            throw new Error(message);
        }

        return body as T;
    }
}
