import { APPLICATION_ERROR, aiModelPreferenceId, defaultGeneralSettings, defaultInterfaceLocale, findKeyBindingConflict, HTTP_STATUS, INTERFACE_LOCALE, isAiProvider, isAssistantSendMode, isDateFormatPreference, isKeyBindingCommandId, isThemePreference, isTimeFormatPreference, isTimeZonePreference, KEY_BINDING_COMMAND, normalizeKeyBinding, parseAiModelPreferenceId, resolveBuiltInSkillId, resolveKeyBindings, type AiConnection, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";


export function generalSettings(value: unknown, rejectInvalidPreferences = false): GeneralSettings {
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


export function backupPolicy(value: unknown): BackupPolicy {
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
    if (!isAiProvider(candidate.provider) || typeof candidate.id !== "string" || typeof candidate.label !== "string")
        return undefined;

    const source = candidate.credentialSource;
    if (source && typeof source === "object" && !Array.isArray(source)) {
        const credentialSource = source as Record<string, unknown>;
        if (credentialSource.kind === "managed")
            return {
                id: candidate.id,
                provider: candidate.provider,
                label: candidate.label,
                credentialSource: { kind: "managed" },
                active: candidate.active !== false,
                status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked"
            };

        if (credentialSource.kind === "environment-variable" && typeof credentialSource.environmentVariableName === "string")
            return {
                id: candidate.id,
                provider: candidate.provider,
                label: candidate.label,
                credentialSource: { kind: "environment-variable", environmentVariableName: credentialSource.environmentVariableName },
                active: candidate.active !== false,
                status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked"
            };
    }

    return typeof candidate.environmentVariableName === "string"
        ? {
            id: candidate.id,
            provider: candidate.provider,
            label: candidate.label,
            credentialSource: { kind: "environment-variable", environmentVariableName: candidate.environmentVariableName },
            active: candidate.active !== false,
            status: candidate.status === "connected" || candidate.status === "unavailable" ? candidate.status : "unchecked"
        }
        : undefined;
}


export function aiConnections(value: unknown): { connections: AiConnection[]; activeConnectionId?: string } {
    const candidate = value && typeof value === "object" ? value as { connections?: unknown; activeConnectionId?: unknown } : {};
    const connections = Array.isArray(candidate.connections) ? candidate.connections.flatMap((connection) => {
        const normalized = normalizeAiConnection(connection);
        return normalized ? [normalized] : [];
    }) : [];
    const activeConnectionId = typeof candidate.activeConnectionId === "string"
        && connections.some((connection) => connection.id === candidate.activeConnectionId) ? candidate.activeConnectionId : connections[0]?.id;

    return { connections, ...(activeConnectionId ? { activeConnectionId } : {}) };
}


export function environmentVariableName(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_ENVIRONMENT_VARIABLE_NAME, HTTP_STATUS.BAD_REQUEST);

    return value;
}


function modelPreference(value: unknown, legacyConnectionId?: string): string {
    if (typeof value !== "string" || !value.trim())
        return "";

    const normalized = value.trim();
    return parseAiModelPreferenceId(normalized) || !legacyConnectionId
        ? normalized
        : aiModelPreferenceId(legacyConnectionId, normalized);
}


export function modelPreferences(value: unknown, legacyConnectionId?: string): ModelPreferences {
    const candidate = value && typeof value === "object" ? value as Partial<ModelPreferences> & { operationOverrides?: unknown } : {};
    const values = candidate.skillOverrides && typeof candidate.skillOverrides === "object" ? candidate.skillOverrides : candidate.operationOverrides;
    const skillOverrides = Object.fromEntries(Object.entries(values ?? {}).flatMap(([skill, model]) => {
        const normalized = resolveBuiltInSkillId(skill);
        const preference = modelPreference(model, legacyConnectionId);
        return normalized && preference ? [[normalized, preference]] : [];
    })) as ModelPreferences["skillOverrides"];

    const textGenerationModel = modelPreference(candidate.textGenerationModel, legacyConnectionId);
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
        ? [...new Set(candidate.favoriteModels.map((model) => modelPreference(model, legacyConnectionId)).filter(Boolean))]
        : [];

    return {
        defaultModel: modelPreference(candidate.defaultModel, legacyConnectionId),
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


export function keyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, false);
}


export function requestedKeyBindingOverrides(value: unknown): KeyBindingOverrides {
    return normalizeKeyBindingOverrides(value, true);
}
