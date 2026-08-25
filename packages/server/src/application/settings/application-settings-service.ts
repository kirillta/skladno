import { APPLICATION_ERROR, defaultGeneralSettings, defaultInterfaceLocale, findKeyBindingConflict, HTTP_STATUS, INTERFACE_LOCALE, isAssistantSendMode, isDateFormatPreference, isKeyBindingCommandId, isThemePreference, isTimeFormatPreference, isTimeZonePreference, KEY_BINDING_COMMAND, normalizeKeyBinding, resolveBuiltInSkillId, resolveKeyBindings, type AiConnection, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { AvailableModelsProvider } from "../ports/available-models-provider.js";
import type { BackupManager } from "../ports/backup-manager.js";
import type { SettingsStore } from "../ports/settings-store.js";
import type { SystemDateTimeFormatProvider } from "../ports/system-date-time-format-provider.js";
import type { ManagedCredentials } from "../ports/managed-credentials.js";


function generalSettings(value: unknown, rejectInvalidPreferences = false): GeneralSettings {
    const candidate = value && typeof value === "object" ? value as Partial<GeneralSettings> : {};
    if (rejectInvalidPreferences
        && ((candidate.theme !== undefined && !isThemePreference(candidate.theme))
            || (candidate.dateFormat !== undefined && !isDateFormatPreference(candidate.dateFormat))
            || (candidate.timeFormat !== undefined && !isTimeFormatPreference(candidate.timeFormat))
            || (candidate.timeZone !== undefined && !isTimeZonePreference(candidate.timeZone))
            || (candidate.assistantSendMode !== undefined && !isAssistantSendMode(candidate.assistantSendMode))
        ))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return {
        ...defaultGeneralSettings,
        ...candidate,
        theme: isThemePreference(candidate.theme) ? candidate.theme : defaultGeneralSettings.theme,
        interfaceLocale: candidate.interfaceLocale === INTERFACE_LOCALE.EN ? candidate.interfaceLocale : defaultInterfaceLocale,
        dateFormat: isDateFormatPreference(candidate.dateFormat) ? candidate.dateFormat : defaultGeneralSettings.dateFormat,
        timeFormat: isTimeFormatPreference(candidate.timeFormat) ? candidate.timeFormat : defaultGeneralSettings.timeFormat,
        timeZone: isTimeZonePreference(candidate.timeZone) ? candidate.timeZone : defaultGeneralSettings.timeZone,
        assistantSendMode: isAssistantSendMode(candidate.assistantSendMode) ? candidate.assistantSendMode : defaultGeneralSettings.assistantSendMode,
        defaultTranslationLanguages: Array.isArray(candidate.defaultTranslationLanguages)
            ? [...new Set(candidate.defaultTranslationLanguages.filter((language): language is string => typeof language === "string" && language !== candidate.defaultArticleLanguage))]
            : [],
    };
}


function backupPolicy(value: unknown): BackupPolicy {
    const candidate = value && typeof value === "object" ? value as Partial<BackupPolicy> : {};
    return {
        schedule: candidate.schedule === "daily" ? "daily" : "off",
        retention: candidate.retention?.mode === "unlimited"
            ? { mode: "unlimited" }
            : { mode: "count", count: Math.min(365, Math.max(1, candidate.retention?.mode === "count" ? candidate.retention.count : 7)) },
    };
}


function normalizeAiConnection(value: unknown): AiConnection | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.provider !== "string" || !candidate.provider || typeof candidate.id !== "string" || typeof candidate.label !== "string")
        return undefined;

    const source = candidate.credentialSource;
    if (source && typeof source === "object" && !Array.isArray(source)) {
        const credentialSource = source as Record<string, unknown>;
        if (credentialSource.kind === "managed")
            return { id: candidate.id, provider: candidate.provider, label: candidate.label, credentialSource: { kind: "managed" }, status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked" };

        if (credentialSource.kind === "environment-variable" && typeof credentialSource.environmentVariableName === "string")
            return { id: candidate.id, provider: candidate.provider, label: candidate.label, credentialSource: { kind: "environment-variable", environmentVariableName: credentialSource.environmentVariableName }, status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked" };
    }

    return typeof candidate.environmentVariableName === "string"
        ? { id: candidate.id, provider: candidate.provider, label: candidate.label, credentialSource: { kind: "environment-variable", environmentVariableName: candidate.environmentVariableName }, status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked" }
        : undefined;
}


function aiConnections(value: unknown): { connections: AiConnection[]; activeConnectionId?: string } {
    const candidate = value && typeof value === "object" ? value as { connections?: unknown; activeConnectionId?: unknown } : {};
    const connections = Array.isArray(candidate.connections) ? candidate.connections.flatMap((connection) => {
        const normalized = normalizeAiConnection(connection);
        return normalized ? [normalized] : [];
    }) : [];
    const activeConnectionId = typeof candidate.activeConnectionId === "string"
        && connections.some((connection) => connection.id === candidate.activeConnectionId) ? candidate.activeConnectionId : connections[0]?.id;

    return { connections, ...(activeConnectionId ? { activeConnectionId } : {}) };
}


function environmentVariableName(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_ENVIRONMENT_VARIABLE_NAME, HTTP_STATUS.BAD_REQUEST);

    return value;
}


function modelPreferences(value: unknown): ModelPreferences {
    const candidate = value && typeof value === "object" ? value as Partial<ModelPreferences> & { operationOverrides?: unknown } : {};
    const values = candidate.skillOverrides && typeof candidate.skillOverrides === "object" ? candidate.skillOverrides : candidate.operationOverrides;
    const skillOverrides = Object.fromEntries(Object.entries(values ?? {}).flatMap(([skill, model]) => {
        const normalized = resolveBuiltInSkillId(skill);
        return normalized && typeof model === "string" ? [[normalized, model.trim()]] : [];
    })) as ModelPreferences["skillOverrides"];

    const textGenerationModel = typeof candidate.textGenerationModel === "string" ? candidate.textGenerationModel.trim() : "";
    const reasoningEffort = candidate.reasoningEffort === "low" || candidate.reasoningEffort === "medium" || candidate.reasoningEffort === "high"
        ? candidate.reasoningEffort
        : undefined;
    const textGenerationReasoningEffort = candidate.textGenerationReasoningEffort === "low" || candidate.textGenerationReasoningEffort === "medium" || candidate.textGenerationReasoningEffort === "high"
        ? candidate.textGenerationReasoningEffort
        : undefined;
    const skillReasoningEfforts = Object.fromEntries(Object.entries(candidate.skillReasoningEfforts ?? {}).flatMap(([skill, effort]) => {
        const normalized = resolveBuiltInSkillId(skill);
        return normalized && (effort === "low" || effort === "medium" || effort === "high") ? [[normalized, effort]] : [];
    })) as NonNullable<ModelPreferences["skillReasoningEfforts"]>;
    const favoriteModels = Array.isArray(candidate.favoriteModels)
        ? [...new Set(candidate.favoriteModels.filter((model): model is string => typeof model === "string").map((model) => model.trim()).filter(Boolean))]
        : [];

    return {
        defaultModel: typeof candidate.defaultModel === "string" ? candidate.defaultModel.trim() : "",
        ...(textGenerationModel ? { textGenerationModel } : {}),
        ...(reasoningEffort ? { reasoningEffort } : {}),
        ...(textGenerationReasoningEffort ? { textGenerationReasoningEffort } : {}),
        skillOverrides,
        ...(Object.keys(skillReasoningEfforts).length > 0 ? { skillReasoningEfforts } : {}),
        ...(favoriteModels.length > 0 ? { favoriteModels } : {}),
    };
}


function normalizeKeyBindingOverrides(value: unknown, rejectInvalid: boolean): KeyBindingOverrides {
    if (!value || typeof value !== "object" || Array.isArray(value))
        if (rejectInvalid)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);
        else
            return {};

    const overrides: KeyBindingOverrides = {};
    for (const [commandId, binding] of Object.entries(value)) {
        if (commandId === KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST)
            continue;

        if (!isKeyBindingCommandId(commandId)) {
            if (rejectInvalid)
                throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

            continue;
        }

        if (binding === null) {
            overrides[commandId] = null;
            continue;
        }

        const normalized = normalizeKeyBinding(binding);
        if (!normalized) {
            if (rejectInvalid)
                throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

            continue;
        }

        overrides[commandId] = normalized;
    }

    if (rejectInvalid) {
        const conflict = findKeyBindingConflict(resolveKeyBindings(overrides));
        if (conflict)
            throw new ApplicationServiceError(APPLICATION_ERROR.KEY_BINDING_CONFLICT, HTTP_STATUS.BAD_REQUEST, { firstCommandId: conflict[0], secondCommandId: conflict[1] });
    }

    return overrides;
}


function keyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, false);
}


function requestedKeyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, true);
}


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
        return {
            general: generalSettings(this.settings.get("application-general")?.value),
            systemDateTimeFormat: await this.dateTimeFormat.read(),
            ...aiConnections(this.settings.get("application-ai-connections")?.value),
            modelPreferences: modelPreferences(this.settings.get("application-model-preferences")?.value),
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


    createAiConnection(value: { label?: unknown; environmentVariableName?: unknown }): AiConnection {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const requestedName = environmentVariableName(value.environmentVariableName);
        if (saved.connections.some((connection) => connection.credentialSource.kind === "environment-variable" && connection.credentialSource.environmentVariableName === requestedName))
            throw new ApplicationServiceError(APPLICATION_ERROR.DUPLICATE_AI_CONNECTION, HTTP_STATUS.BAD_REQUEST, { environmentVariableName: requestedName });

        const connection: AiConnection = {
            id: this.createConnectionId(),
            provider: "openai",
            label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : "OpenAI",
            credentialSource: { kind: "environment-variable", environmentVariableName: requestedName }, status: "unchecked"
        };
        saved.connections.push(connection);
        this.settings.set("application-ai-connections", { ...saved, activeConnectionId: saved.activeConnectionId ?? connection.id });

        return connection;
    }


    async createManagedAiConnection(value: { label?: unknown; apiKey?: unknown }): Promise<AiConnection> {
        if (!this.credentials?.available() || typeof value.apiKey !== "string" || !value.apiKey.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const connection: AiConnection = { id: this.createConnectionId(), provider: "openai", label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : "OpenAI", credentialSource: { kind: "managed" }, status: "unchecked" };
        try {
            await this.models.list(connection, value.apiKey);
        } catch {
            throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);
        }

        this.credentials.set(connection.id, value.apiKey);
        try {
            const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
            saved.connections.push({ ...connection, status: "connected", lastCheckedAt: new Date().toISOString() });
            this.settings.set("application-ai-connections", { ...saved, activeConnectionId: saved.activeConnectionId ?? connection.id });

            return saved.connections.at(-1)!;
        } catch (error) {
            this.credentials.delete(connection.id);
            throw error;
        }
    }


    activateAiConnection(connectionId: string): void {
        const { saved } = this.connectionState(connectionId);
        this.settings.set("application-ai-connections", { ...saved, activeConnectionId: connectionId });
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
        if (saved.activeConnectionId === connectionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REMOVAL_BLOCKED, HTTP_STATUS.BAD_REQUEST);

        if (connection.credentialSource.kind === "managed")
            this.credentials?.delete(connection.id);

        saved.connections.splice(index, 1);
        this.settings.set("application-ai-connections", { connections: saved.connections, ...(saved.connections[0] ? { activeConnectionId: saved.connections[0].id } : {}) });
    }


    async listAiModels(): Promise<string[]> {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const active = saved.connections.find((connection) => connection.id === saved.activeConnectionId);
        if (!active)
            throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        return this.models.list(active);
    }


    private connectionState(connectionId: string): { saved: { connections: AiConnection[]; activeConnectionId?: string }; index: number; connection: AiConnection } {
        const saved = aiConnections(this.settings.get("application-ai-connections")?.value);
        const index = saved.connections.findIndex((connection) => connection.id === connectionId);
        if (index < 0)
            throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        return { saved, index, connection: saved.connections[index]! };
    }
}
