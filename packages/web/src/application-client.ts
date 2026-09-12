import {
    ArticleRevisionConflictError,
    ArticleDraftConflictError,
    ApplicationClientError,
    healthPath,
    HTTP_METHOD,
    HTTP_STATUS,
    parseHealthResponse,
    type Article,
    type HealthResponse,
    type ArticleDraft,
    articleStyleCorpusSnapshotPath, articleStyleRulesPath, styleCorpusPath, styleCorpusRebuildPath, styleCorpusRulesPath,
    type CreateStyleCorpusItemInput,
    type StyleCorpus,
    publishSettingsPath,
    type PublishingSettings,
    type EditorialWorkspaceClient,
    aiConnectionsPath,
    aiModelsPath,
    aiModelPreferencesPath,
    aiAppModelPath,
    keyBindingsPath,
    type KeyBindingOverrides,
    type ModelPreferences,
    type AppModelPreference,
    type AiConnection,
    type AvailableAiModel,
} from "@skladno/shared";
import { applicationClientError } from "./http-client-transport.js";
import { HttpArticleClient } from "./http-article-client.js";

export type { EditorialWorkspaceClient } from "@skladno/shared";


/** HTTP implementation of the UI's transport-neutral application boundary. */
export class HttpApplicationClient extends HttpArticleClient implements EditorialWorkspaceClient {
    async getHealth(): Promise<HealthResponse> {
        const response = await fetch(`${this.serviceUrl}${healthPath}`);
        if (!response.ok)
            throw new ApplicationClientError("editorial_request_failed", { status: response.status }, response.status);

        return parseHealthResponse(await response.json());
    }


    async updateKeyBindingOverrides(input: KeyBindingOverrides): Promise<KeyBindingOverrides> {
        return this.request<KeyBindingOverrides>(keyBindingsPath, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async addAiConnection(input: { label: string; environmentVariableName: string }): Promise<AiConnection> {
        return this.request<AiConnection>(aiConnectionsPath, { method: HTTP_METHOD.POST, body: JSON.stringify(input) });
    }


    async updateAiConnection(connectionId: string, input: { label: string; environmentVariableName: string }): Promise<AiConnection> {
        return this.request<AiConnection>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}`, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async removeAiConnection(connectionId: string): Promise<void> {
        await this.request<void>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}`, { method: HTTP_METHOD.DELETE });
    }


    async setAiConnectionActive(connectionId: string, active: boolean): Promise<AiConnection> {
        return this.request<AiConnection>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}/active`, { method: HTTP_METHOD.PUT, body: JSON.stringify({ active }) });
    }


    async testAiConnection(connectionId: string): Promise<AiConnection> {
        return this.request<AiConnection>(`${aiConnectionsPath}/${encodeURIComponent(connectionId)}/test`, { method: HTTP_METHOD.POST });
    }


    async refreshAiModels(): Promise<AvailableAiModel[]> {
        return this.request<AvailableAiModel[]>(aiModelsPath, { method: HTTP_METHOD.POST });
    }


    async updateModelPreferences(input: ModelPreferences): Promise<ModelPreferences> {
        return this.request<ModelPreferences>(aiModelPreferencesPath, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
    }


    async updateAppModel(input: AppModelPreference | null): Promise<AppModelPreference | null> {
        return this.request<AppModelPreference | null>(aiAppModelPath, { method: HTTP_METHOD.PUT, body: JSON.stringify(input) });
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


    protected async request<T>(path: string, init?: RequestInit): Promise<T> {
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
