import { APPLICATION_ERROR, aiModelPreferenceId, AI_PROVIDER, HTTP_STATUS, isAiProvider, parseAiModelPreferenceId, type AiConnection, type AiProvider, type ApplicationSettingsSnapshot, type AvailableAiModel, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { AvailableModelsProvider } from "../ports/available-models-provider.js";
import type { BackupManager } from "../ports/backup-manager.js";
import type { SettingsStore } from "../ports/settings-store.js";
import type { SystemDateTimeFormatProvider } from "../ports/system-date-time-format-provider.js";
import type { ManagedCredentials } from "../ports/managed-credentials.js";
import { aiConnections, backupPolicy, environmentVariableName, generalSettings, keyBindingOverrides, modelPreferences, requestedKeyBindingOverrides } from "./application-settings-normalizers.js";


export class ApplicationSettingsService {
    constructor(
        private readonly settings: SettingsStore,
        private readonly dateTimeFormat: SystemDateTimeFormatProvider,
        private readonly models: AvailableModelsProvider,
        private readonly createConnectionId: () => string,
        private readonly backups?: BackupManager,
        private readonly credentials?: ManagedCredentials,
    ) { }


    async getSnapshot(): Promise<ApplicationSettingsSnapshot> {
        const connections = aiConnections(this.settings.get("application-ai-connections")?.value);
        const rawPreferences = this.settings.get("application-model-preferences")?.value;
        const legacyPreferences = rawPreferences && typeof rawPreferences === "object" && !Array.isArray(rawPreferences)
            ? (rawPreferences as { byConnection?: unknown }).byConnection
            : undefined;
        const preferences = legacyPreferences && typeof legacyPreferences === "object" && !Array.isArray(legacyPreferences)
            ? modelPreferences((legacyPreferences as Record<string, unknown>)[connections.activeConnectionId ?? ""], connections.activeConnectionId)
            : modelPreferences(rawPreferences, connections.activeConnectionId);
        const hasLegacyModelIds = rawPreferences && typeof rawPreferences === "object" && !Array.isArray(rawPreferences)
            && !legacyPreferences && typeof (rawPreferences as { defaultModel?: unknown }).defaultModel === "string"
            && !parseAiModelPreferenceId((rawPreferences as { defaultModel: string }).defaultModel);
        if (legacyPreferences || hasLegacyModelIds)
            this.settings.set("application-model-preferences", preferences);

        return {
            general: generalSettings(this.settings.get("application-general")?.value),
            systemDateTimeFormat: await this.dateTimeFormat.read(),
            connections: connections.connections,
            modelPreferences: preferences,
            backupPolicy: backupPolicy(this.settings.get("application-backup-policy")?.value),
            keyBindingOverrides: keyBindingOverrides(this.settings.get("application-key-bindings")?.value),
        };
    }


    updateGeneral(value: unknown): GeneralSettings {
        const normalized = generalSettings(value, true);
        this.settings.set("application-general", normalized);

        return normalized;
    }


    updateBackupPolicy(value: unknown): BackupPolicy {
        const normalized = backupPolicy(value);
        this.settings.set("application-backup-policy", normalized);

        return normalized;
    }


    createBackup(): { path: string; createdAt: string; cleanup(): void } {
        if (!this.backups)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED, HTTP_STATUS.INTERNAL_SERVER_ERROR);

        return this.backups.createTemporary();
    }


    updateKeyBindingOverrides(value: unknown): KeyBindingOverrides {
        const normalized = requestedKeyBindingOverrides(value);
        this.settings.set("application-key-bindings", normalized);

        return normalized;
    }


    updateModelPreferences(value: unknown): ModelPreferences {
        const normalized = modelPreferences(value);
        this.settings.set("application-model-preferences", normalized);

        return normalized;
    }


    createAiConnection(value: { provider?: unknown; label?: unknown; environmentVariableName?: unknown }): AiConnection {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const requestedName = environmentVariableName(value.environmentVariableName);

        const connection: AiConnection = {
            id: this.createConnectionId(),
            provider: this.provider(value.provider),
            label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : this.providerLabel(this.provider(value.provider)),
            credentialSource: { kind: "environment-variable", environmentVariableName: requestedName }, active: true, status: "unchecked"
        };
        saved.connections.push(connection);
        this.settings.set("application-ai-connections", { connections: saved.connections });

        return connection;
    }


    async createManagedAiConnection(value: { provider?: unknown; label?: unknown; apiKey?: unknown }): Promise<AiConnection> {
        if (!this.credentials?.available() || typeof value.apiKey !== "string" || !value.apiKey.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const provider = this.provider(value.provider);
        const connection: AiConnection = { id: this.createConnectionId(), provider, label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : this.providerLabel(provider), credentialSource: { kind: "managed" }, active: true, status: "unchecked" };
        try {
            await this.models.list(connection, value.apiKey);
        } catch {
            throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);
        }

        this.credentials.set(connection.id, value.apiKey);
        try {
            const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
            saved.connections.push({ ...connection, status: "connected", lastCheckedAt: new Date().toISOString() });
            this.settings.set("application-ai-connections", { connections: saved.connections });

            return saved.connections.at(-1)!;
        } catch (error) {
            this.credentials.delete(connection.id);
            throw error;
        }
    }


    setAiConnectionActive(connectionId: string, active: boolean): AiConnection {
        const { saved, index, connection } = this.connectionState(connectionId);
        const updated = { ...connection, active };
        saved.connections[index] = updated;
        this.settings.set("application-ai-connections", { connections: saved.connections });

        return updated;
    }


    async testAiConnection(connectionId: string): Promise<AiConnection> {
        const { saved, index, connection } = this.connectionState(connectionId);
        try {
            await this.models.list(connection);
            saved.connections[index] = { ...connection, status: "connected", lastCheckedAt: new Date().toISOString(), diagnostic: undefined };
        } catch (error) {
            saved.connections[index] = {
                ...connection, status: "unavailable",
                lastCheckedAt: new Date().toISOString(),
                diagnostic: error instanceof Error ? error.message : APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED
            };
        }

        this.settings.set("application-ai-connections", saved);

        return saved.connections[index]!;
    }


    updateAiConnection(connectionId: string, value: { label?: unknown; environmentVariableName?: unknown }): AiConnection {
        const { saved, index, connection } = this.connectionState(connectionId);
        const updated = {
            ...connection,
            label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : connection.label,
            credentialSource: { kind: "environment-variable" as const, environmentVariableName: environmentVariableName(value.environmentVariableName) },
            status: "unchecked" as const,
            diagnostic: undefined,
            lastCheckedAt: undefined
        };
        saved.connections[index] = updated;
        this.settings.set("application-ai-connections", saved);

        return updated;
    }


    renameManagedAiConnection(connectionId: string, label: unknown): AiConnection {
        const { saved, index, connection } = this.connectionState(connectionId);
        if (connection.credentialSource.kind !== "managed")
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const updated = { ...connection, label: typeof label === "string" && label.trim() ? label.trim() : connection.label };
        saved.connections[index] = updated;
        this.settings.set("application-ai-connections", saved);

        return updated;
    }


    deleteAiConnection(connectionId: string): void {
        const { saved, index, connection } = this.connectionState(connectionId);
        if (connection.credentialSource.kind === "managed")
            this.credentials?.delete(connection.id);

        saved.connections.splice(index, 1);
        this.settings.set("application-ai-connections", { connections: saved.connections });
    }


    async listAiModels(): Promise<AvailableAiModel[]> {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const lists = await Promise.allSettled(saved.connections.filter((connection) => connection.active).map(async (connection) =>
            (await this.models.list(connection)).map((model) => ({ id: aiModelPreferenceId(connection.id, model), model, connectionId: connection.id, provider: connection.provider }))));

        return lists.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    }


    private connectionState(connectionId: string): { saved: { connections: AiConnection[]; activeConnectionId?: string }; index: number; connection: AiConnection } {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const index = saved.connections.findIndex((connection) => connection.id === connectionId);
        if (index < 0)
            throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        return { saved, index, connection: saved.connections[index]! };
    }


    private provider(value: unknown): AiProvider {
        if (value === undefined)
            return AI_PROVIDER.OPENAI;

        if (!isAiProvider(value))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        return value;
    }


    private providerLabel(provider: AiProvider): string {
        return {
            [AI_PROVIDER.OPENAI]: "OpenAI",
            [AI_PROVIDER.OPENCODE]: "OpenCode Zen",
            [AI_PROVIDER.ANTHROPIC]: "Anthropic",
            [AI_PROVIDER.GOOGLE]: "Google Gemini",
            [AI_PROVIDER.XAI]: "xAI Grok",
            [AI_PROVIDER.DEEPSEEK]: "DeepSeek",
        }[provider];
    }
}
