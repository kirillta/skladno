import {
    ArticleRevisionConflictError,
    ArticleDraftConflictError,
    ApplicationClientError,
    type ApplicationErrorPayload,
    acceptProposalPath,
    articlesPath,
    assistantMessagesPath,
    assistantRequestsPath,
    articleRevisionsPath,
    articleDraftPath,
    editorialPath,
    factCheckResolutionPath,
    factChecksPath,
    healthPath,
    HTTP_METHOD,
    HTTP_STATUS,
    parseHealthResponse,
    type CreateArticleInput,
    type Article,
    type HealthResponse,
    type SaveArticleRevisionInput,
    type SaveArticleDraftInput,
    type ArticleDraft,
    type AcceptProposalInput,
    type ArticleRevision,
    type AssistantMessage,
    type AssistantEvent,
    type StartAssistantRequest,
    type EditorialEvent,
    type StartEditorialRequest,
    restoreRevisionPath,
    articleStyleCorpusSnapshotPath, articleStyleRulesPath, styleCorpusPath, styleCorpusRebuildPath, styleCorpusRulesPath,
    type CreateStyleCorpusItemInput,
    type StyleCorpus,
    publishSettingsPath,
    type PublishingSettings,
    applicationSettingsPath,
    backupsPath,
    type EditorialWorkspaceClient,
    type ApplicationSettingsSnapshot,
    type BackupPolicy,
    type GeneralSettings,
    aiConnectionsPath,
    aiModelsPath,
    aiModelPreferencesPath,
    keyBindingsPath,
    type KeyBindingOverrides,
    type ModelPreferences,
    type OpenAiConnection,
    proposalSummariesPath,
    type ProposalChangeSummary,
    type SummarizeProposalInput,
    type FactCheck,
    type FactCheckFinding,
} from "@skladno/shared";
import { configureSystemDateTimeFormat } from "./i18n/formatting.js";

export type { EditorialWorkspaceClient } from "@skladno/shared";


/** HTTP implementation of the UI's transport-neutral application boundary. */


function applicationClientError(payload: unknown, status: number): ApplicationClientError {
    if (payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string") {
        const error = payload as ApplicationErrorPayload;
        return new ApplicationClientError(error.code, error.parameters, status);
    }

    return new ApplicationClientError("editorial_request_failed", { status }, status);
}


function streamData(message: string): string | undefined {
    return message.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
}


async function streamEvents<Event>(body: ReadableStream<Uint8Array>, parse: (data: string) => Event, onEvent: (event: Event) => void): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
            const data = streamData(message);
            if (data)
                onEvent(parse(data));
        }

        if (done)
            return;
    }
}


export class HttpApplicationClient implements EditorialWorkspaceClient {
    constructor(private readonly serviceUrl = "http://127.0.0.1:8787") { }


    async getHealth(): Promise<HealthResponse> {
        const response = await fetch(`${this.serviceUrl}${healthPath}`);
        if (!response.ok)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);

        return parseHealthResponse(await response.json());
    }


    async getApplicationSettings(): Promise<ApplicationSettingsSnapshot> {
        const settings = await this.request<ApplicationSettingsSnapshot>(applicationSettingsPath);
        configureSystemDateTimeFormat(settings.systemDateTimeFormat);

        return settings;
    }


    async updateGeneralSettings(input: GeneralSettings): Promise<GeneralSettings> {
        return this.request<GeneralSettings>(`${applicationSettingsPath}/general`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async updateBackupPolicy(input: BackupPolicy): Promise<BackupPolicy> {
        return this.request<BackupPolicy>(`${applicationSettingsPath}/backup-policy`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async createBackup(): Promise<Blob> {
        const response = await fetch(`${this.serviceUrl}${backupsPath}`, { method: HTTP_METHOD.POST });
        if (!response.ok)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);

        return response.blob();
    }


    async updateKeyBindingOverrides(input: KeyBindingOverrides): Promise<KeyBindingOverrides> {
        return this.request<KeyBindingOverrides>(keyBindingsPath, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async addOpenAiConnection(input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection> {
        return this.request<OpenAiConnection>(aiConnectionsPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async updateOpenAiConnection(connectionId: string, input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection> {
        return this.request<OpenAiConnection>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async removeOpenAiConnection(connectionId: string): Promise<void> {
        await this.request<void>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}`, { method: HTTP_METHOD.DELETE });
    }


    async setActiveOpenAiConnection(connectionId: string): Promise<void> {
        await this.request<void>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}/active`, { method: HTTP_METHOD.PUT });
    }


    async testOpenAiConnection(connectionId: string): Promise<OpenAiConnection> {
        return this.request<OpenAiConnection>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}/test`, { method: HTTP_METHOD.POST });
    }


    async refreshOpenAiModels(): Promise<string[]> {
        return this.request<string[]>(aiModelsPath, { method: HTTP_METHOD.POST });
    }


    async updateModelPreferences(input: ModelPreferences): Promise<ModelPreferences> {
        return this.request<ModelPreferences>(aiModelPreferencesPath, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async listArticles(): Promise<Article[]> {
        return this.request<Article[]>(articlesPath);
    }


    async createArticle(input: CreateArticleInput): Promise<Article> {
        return this.request<Article>(articlesPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
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

        await streamEvents(response.body, (data) => JSON.parse(data) as AssistantEvent, (event) => {
            if (event.type === "error")
                throw new ApplicationClientError(event.errorCode, undefined, response.status);

            onEvent(event);
        });
    }


    async updateArticle(articleId: string, input: import("@skladno/shared").UpdateArticleInput): Promise<Article> {
        return this.request<Article>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.PATCH, body: JSON.stringify(input) });
    }


    async deleteArticle(articleId: string): Promise<void> {
        await this.request<void>(`${articlesPath}/${encodeURIComponent(articleId)}`, { method: HTTP_METHOD.DELETE });
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


    async getStyleCorpus(): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath);
    }


    async addStyleCorpusItem(input: CreateStyleCorpusItemInput): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async removeStyleCorpusItem(materialId: string): Promise<void> {
        await this.request<void>(`${styleCorpusPath}/${encodeURIComponent(materialId)}`, { method: HTTP_METHOD.DELETE });
    }


    async setStyleCorpusItemIncluded(itemId: string, included: boolean): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(`${styleCorpusPath}/${encodeURIComponent(itemId)}`, { method: HTTP_METHOD.PUT, body: JSON.stringify({ included }) });
    }


    async setStyleCorpusRules(rules: string): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusRulesPath, { method: HTTP_METHOD.PUT, body: JSON.stringify({ rules }) });
    }


    async rebuildStyleCorpus(): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(styleCorpusRebuildPath, { method: HTTP_METHOD.POST });
    }


    async getArticleStyleRules(articleId: string): Promise<string> {
        return (await this.request<{ rules: string }>(articleStyleRulesPath(articleId))).rules;
    }


    async setArticleStyleRules(articleId: string, rules: string): Promise<string> {
        return (await this.request<{ rules: string }>(articleStyleRulesPath(articleId), { method: HTTP_METHOD.PUT, body: JSON.stringify({ rules }) })).rules;
    }


    async addArticleRevisionStyleCorpusItem(articleId: string, revisionId: string): Promise<StyleCorpus> {
        return this.request<StyleCorpus>(articleStyleCorpusSnapshotPath(articleId, revisionId), { method: HTTP_METHOD.POST });
    }


    async getPublishingSettings(): Promise<PublishingSettings> {
        return this.request<PublishingSettings>(publishSettingsPath);
    }


    async setPublishingSettings(settings: PublishingSettings): Promise<PublishingSettings> {
        return this.request<PublishingSettings>(publishSettingsPath, {
            method: HTTP_METHOD.PUT,
            body: JSON.stringify(settings),
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


    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        const response = await fetch(`${this.serviceUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
        if (response.status === HTTP_STATUS.NO_CONTENT)
            return undefined as T;

        const body: unknown = await response.json().catch(() => ({}));
        if (response.status === HTTP_STATUS.CONFLICT && typeof body === "object" && body !== null && "article" in body) {
            const conflict = body as { error?: { code?: string }; article: Article; draft?: ArticleDraft };
            if (conflict.error?.code === "draft_conflict")
                throw new ArticleDraftConflictError(conflict.article, conflict.draft);

            throw new ArticleRevisionConflictError(conflict.article);
        }

        if (!response.ok) {
            const payload = typeof body === "object" && body !== null && "error" in body
                ? (body as { error: unknown }).error
                : undefined;
            throw applicationClientError(payload, response.status);
        }

        return body as T;
    }
}
