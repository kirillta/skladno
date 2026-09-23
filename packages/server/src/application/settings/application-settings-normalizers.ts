import { APPLICATION_ERROR, getAiModelPreferenceId, defaultGeneralSettings, defaultInterfaceLocale, findKeyBindingConflict, HTTP_STATUS, INTERFACE_LOCALE, isAiProvider, isAssistantSendMode, isDateFormatPreference, isKeyBindingCommandId, isThemePreference, isTimeFormatPreference, isTimeZonePreference, KEY_BINDING_COMMAND, normalizeKeyBinding, parseAiModelPreferenceId, resolveBuiltInSkillId, resolveKeyBindings, type AiConnection, type AppModelPreference, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";


function isAssistantRequestTimeout(value: unknown): value is GeneralSettings["assistantRequestTimeoutMinutes"] {
    return value === "unlimited" || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 30);
}


function hasInvalidGeneralPreferences(candidate: Partial<GeneralSettings>): boolean {
    return (candidate.theme !== undefined && !isThemePreference(candidate.theme))
        || (candidate.dateFormat !== undefined && !isDateFormatPreference(candidate.dateFormat))
        || (candidate.timeFormat !== undefined && !isTimeFormatPreference(candidate.timeFormat))
        || (candidate.timeZone !== undefined && !isTimeZonePreference(candidate.timeZone))
        || (candidate.assistantSendMode !== undefined && !isAssistantSendMode(candidate.assistantSendMode))
        || (candidate.assistantRequestTimeoutMinutes !== undefined && !isAssistantRequestTimeout(candidate.assistantRequestTimeoutMinutes));
}


function normalizeTranslationLanguages(candidate: Partial<GeneralSettings>): string[] {
    if (!Array.isArray(candidate.defaultTranslationLanguages))
        return [];

    return [...new Set(candidate.defaultTranslationLanguages.filter((language): language is string => typeof language === "string" && language !== candidate.defaultArticleLanguage))];
}


function normalizeGeneralPreferences(candidate: Partial<GeneralSettings>): Pick<GeneralSettings, "theme" | "interfaceLocale" | "dateFormat" | "timeFormat" | "timeZone" | "assistantSendMode" | "assistantRequestTimeoutMinutes"> {
    return {
        theme: isThemePreference(candidate.theme) ? candidate.theme : defaultGeneralSettings.theme,
        interfaceLocale: candidate.interfaceLocale === INTERFACE_LOCALE.EN ? candidate.interfaceLocale : defaultInterfaceLocale,
        dateFormat: isDateFormatPreference(candidate.dateFormat) ? candidate.dateFormat : defaultGeneralSettings.dateFormat,
        timeFormat: isTimeFormatPreference(candidate.timeFormat) ? candidate.timeFormat : defaultGeneralSettings.timeFormat,
        timeZone: isTimeZonePreference(candidate.timeZone) ? candidate.timeZone : defaultGeneralSettings.timeZone,
        assistantSendMode: isAssistantSendMode(candidate.assistantSendMode) ? candidate.assistantSendMode : defaultGeneralSettings.assistantSendMode,
        assistantRequestTimeoutMinutes: isAssistantRequestTimeout(candidate.assistantRequestTimeoutMinutes) ? candidate.assistantRequestTimeoutMinutes : defaultGeneralSettings.assistantRequestTimeoutMinutes,
    };
}


export function normalizeGeneralSettings(value: unknown, rejectInvalidPreferences = false): GeneralSettings {
    const candidate = value && typeof value === "object" ? value as Partial<GeneralSettings> : {};
    if (rejectInvalidPreferences && hasInvalidGeneralPreferences(candidate))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return {
        ...defaultGeneralSettings,
        ...candidate,
        ...normalizeGeneralPreferences(candidate),
        defaultTranslationLanguages: normalizeTranslationLanguages(candidate),
    };
}


export function normalizeBackupPolicy(value: unknown): BackupPolicy {
    const candidate = value && typeof value === "object" ? value as Partial<BackupPolicy> : {};
    return {
        schedule: candidate.schedule === "daily" ? "daily" : "off",
        retention: candidate.retention?.mode === "unlimited"
            ? { mode: "unlimited" }
            : { mode: "count", count: Math.min(365, Math.max(1, candidate.retention?.mode === "count" ? candidate.retention.count : 7)) },
    };
}


function normalizeCredentialSource(source: unknown, legacyEnvironmentVariableName: unknown): AiConnection["credentialSource"] | undefined {
    if (source && typeof source === "object" && !Array.isArray(source)) {
        const sourceCandidate = source as Record<string, unknown>;
        if (sourceCandidate.kind === "managed")
            return { kind: "managed" };

        if (sourceCandidate.kind === "environment-variable" && typeof sourceCandidate.environmentVariableName === "string")
            return { kind: "environment-variable", environmentVariableName: sourceCandidate.environmentVariableName };
    }

    if (typeof legacyEnvironmentVariableName === "string")
        return { kind: "environment-variable", environmentVariableName: legacyEnvironmentVariableName };

    return undefined;
}


function normalizeAiConnection(value: unknown): AiConnection | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const candidate = value as Record<string, unknown>;
    if (!isAiProvider(candidate.provider) || typeof candidate.id !== "string" || typeof candidate.label !== "string")
        return undefined;

    const connection: Omit<AiConnection, "credentialSource"> = {
        id: candidate.id,
        provider: candidate.provider,
        label: candidate.label,
        active: candidate.active !== false,
        status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked"
    };
    const credentialSource = normalizeCredentialSource(candidate.credentialSource, candidate.environmentVariableName);

    return credentialSource ? { ...connection, credentialSource } : undefined;
}


export function normalizeAiConnections(value: unknown): { connections: AiConnection[]; activeConnectionId?: string } {
    const candidate = value && typeof value === "object" ? value as { connections?: unknown; activeConnectionId?: unknown } : {};
    const connections = Array.isArray(candidate.connections) ? candidate.connections.flatMap((connection) => {
        const normalized = normalizeAiConnection(connection);
        return normalized ? [normalized] : [];
    }) : [];
    const activeConnectionId = typeof candidate.activeConnectionId === "string"
        && connections.some((connection) => connection.id === candidate.activeConnectionId) ? candidate.activeConnectionId : connections[0]?.id;

    return { connections, ...(activeConnectionId ? { activeConnectionId } : {}) };
}


export function getEnvironmentVariableName(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_ENVIRONMENT_VARIABLE_NAME, HTTP_STATUS.BAD_REQUEST);

    return value;
}


function normalizeModelPreference(value: unknown, legacyConnectionId?: string): string {
    if (typeof value !== "string" || !value.trim())
        return "";

    const normalized = value.trim();
    return parseAiModelPreferenceId(normalized) || !legacyConnectionId
        ? normalized
        : getAiModelPreferenceId(legacyConnectionId, normalized);
}


function normalizeReasoningEffort(value: unknown): AppModelPreference["reasoningEffort"] | undefined {
    if (value === "low" || value === "medium" || value === "high")
        return value;

    return undefined;
}


export function normalizeAppModel(value: unknown, legacyConnectionId?: string): AppModelPreference | undefined {
    const candidate = value && typeof value === "object" && !Array.isArray(value)
        ? value as { model?: unknown; reasoningEffort?: unknown; appModel?: unknown; textGenerationModel?: unknown; textGenerationReasoningEffort?: unknown }
        : {};
    const nested = candidate.appModel && typeof candidate.appModel === "object" && !Array.isArray(candidate.appModel)
        ? candidate.appModel as { model?: unknown; reasoningEffort?: unknown }
        : undefined;
    const model = normalizeModelPreference(nested?.model ?? candidate.model ?? candidate.textGenerationModel, legacyConnectionId);
    const reasoningEffort = normalizeReasoningEffort(nested?.reasoningEffort ?? candidate.reasoningEffort ?? candidate.textGenerationReasoningEffort);
    if (!model)
        return undefined;

    return { model, ...(reasoningEffort ? { reasoningEffort } : {}) };
}


function normalizeSkillOverrides(values: unknown, legacyConnectionId?: string): ModelPreferences["skillOverrides"] {
    return Object.fromEntries(Object.entries(values ?? {}).flatMap(([skill, model]) => {
        const normalized = resolveBuiltInSkillId(skill);
        const preference = normalizeModelPreference(model, legacyConnectionId);
        return normalized && preference ? [[normalized, preference]] : [];
    })) as ModelPreferences["skillOverrides"];
}


function normalizeSkillReasoningEfforts(values: ModelPreferences["skillReasoningEfforts"]): NonNullable<ModelPreferences["skillReasoningEfforts"]> {
    return Object.fromEntries(Object.entries(values ?? {}).flatMap(([skill, effort]) => {
        const normalized = resolveBuiltInSkillId(skill);
        return normalized && (effort === "low" || effort === "medium" || effort === "high") ? [[normalized, effort]] : [];
    })) as NonNullable<ModelPreferences["skillReasoningEfforts"]>;
}


function normalizeFavoriteModels(values: unknown, legacyConnectionId?: string): string[] {
    if (!Array.isArray(values))
        return [];

    return [...new Set(values.map((model) => normalizeModelPreference(model, legacyConnectionId)).filter(Boolean))];
}


export function normalizeModelPreferences(value: unknown, legacyConnectionId?: string): ModelPreferences {
    const candidate = value && typeof value === "object" ? value as Partial<ModelPreferences> & { operationOverrides?: unknown } : {};
    const values = candidate.skillOverrides && typeof candidate.skillOverrides === "object" ? candidate.skillOverrides : candidate.operationOverrides;
    const skillOverrides = normalizeSkillOverrides(values, legacyConnectionId);
    const reasoningEffort = normalizeReasoningEffort(candidate.reasoningEffort);
    const skillReasoningEfforts = normalizeSkillReasoningEfforts(candidate.skillReasoningEfforts);
    const favoriteModels = normalizeFavoriteModels(candidate.favoriteModels, legacyConnectionId);

    return {
        defaultModel: normalizeModelPreference(candidate.defaultModel, legacyConnectionId),
        ...(reasoningEffort ? { reasoningEffort } : {}),
        skillOverrides,
        ...(Object.keys(skillReasoningEfforts).length > 0 ? { skillReasoningEfforts } : {}),
        ...(favoriteModels.length > 0 ? { favoriteModels } : {}),
    };
}


function invalidKeyBinding(rejectInvalid: boolean): KeyBindingOverrides {
    if (rejectInvalid)
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

    return {};
}


function normalizeBindingEntry(overrides: KeyBindingOverrides, commandId: string, binding: unknown, rejectInvalid: boolean): void {
    if (commandId === KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST)
        return;

    if (!isKeyBindingCommandId(commandId)) {
        invalidKeyBinding(rejectInvalid);
        return;
    }

    if (binding === null) {
        overrides[commandId] = null;
        return;
    }

    const normalized = normalizeKeyBinding(binding);
    if (!normalized) {
        invalidKeyBinding(rejectInvalid);
        return;
    }

    overrides[commandId] = normalized;
}


function validateKeyBindingConflicts(overrides: KeyBindingOverrides, rejectInvalid: boolean): void {
    if (!rejectInvalid)
        return;

    const conflict = findKeyBindingConflict(resolveKeyBindings(overrides));
    if (conflict)
        throw new ApplicationServiceError(APPLICATION_ERROR.KEY_BINDING_CONFLICT, HTTP_STATUS.BAD_REQUEST, { firstCommandId: conflict[0], secondCommandId: conflict[1] });
}


function normalizeKeyBindingOverrides(value: unknown, rejectInvalid: boolean): KeyBindingOverrides {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return invalidKeyBinding(rejectInvalid);

    const overrides: KeyBindingOverrides = {};
    for (const [commandId, binding] of Object.entries(value))
        normalizeBindingEntry(overrides, commandId, binding, rejectInvalid);

    validateKeyBindingConflicts(overrides, rejectInvalid);
    return overrides;
}


export function normalizeStoredKeyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, false);
}


export function normalizeRequestedKeyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, true);
}
