import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { APPLICATION_ERROR, aiConnectionsPath, aiModelPreferencesPath, aiModelsPath, applicationSettingsPath, defaultGeneralSettings, defaultInterfaceLocale, findKeyBindingConflict, HTTP_METHOD, HTTP_STATUS, INTERFACE_LOCALE, isDateFormatPreference, isKeyBindingCommandId, isTimeFormatPreference, isTimeZonePreference, keyBindingsPath, normalizeKeyBinding, resolveBuiltInSkillId, resolveKeyBindings, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";

import { ApplicationServiceError } from "../../application/errors/application-service-error.js";
import { listAvailableModels } from "../../infrastructure/editorial/available-models.js";
import { Repositories } from "../../infrastructure/persistence/index.js";
import { readSystemDateTimeFormat } from "../../infrastructure/configuration/system-date-time-format.js";
import { object, readJson, writeJson } from "../transport/json.js";


function generalSettings(value: unknown, rejectInvalidPreferences = false): GeneralSettings {
    const candidate = value && typeof value === "object" ? value as Partial<GeneralSettings> : {};
    if (rejectInvalidPreferences && (
        (candidate.dateFormat !== undefined && !isDateFormatPreference(candidate.dateFormat))
        || (candidate.timeFormat !== undefined && !isTimeFormatPreference(candidate.timeFormat))
        || (candidate.timeZone !== undefined && !isTimeZonePreference(candidate.timeZone))
    ))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return {
        ...defaultGeneralSettings,
        ...candidate,
        interfaceLocale: candidate.interfaceLocale === INTERFACE_LOCALE.EN ? candidate.interfaceLocale : defaultInterfaceLocale,
        dateFormat: isDateFormatPreference(candidate.dateFormat) ? candidate.dateFormat : defaultGeneralSettings.dateFormat,
        timeFormat: isTimeFormatPreference(candidate.timeFormat) ? candidate.timeFormat : defaultGeneralSettings.timeFormat,
        timeZone: isTimeZonePreference(candidate.timeZone) ? candidate.timeZone : defaultGeneralSettings.timeZone,
        defaultTranslationLanguages: Array.isArray(candidate.defaultTranslationLanguages)
            ? [...new Set(candidate.defaultTranslationLanguages.filter((language): language is string => typeof language === "string" && language !== candidate.defaultArticleLanguage))]
            : [],
    };
}


function backupPolicy(value: unknown): BackupPolicy {
    const candidate = value && typeof value === "object" ? value as Partial<BackupPolicy> : {};
    return {
        destinationPath: typeof candidate.destinationPath === "string" ? candidate.destinationPath : undefined,
        schedule: candidate.schedule === "daily" ? "daily" : "off",
        retention: candidate.retention?.mode === "unlimited"
            ? { mode: "unlimited" }
            : { mode: "count", count: Math.min(365, Math.max(1, candidate.retention?.mode === "count" ? candidate.retention.count : 7)) },
    };
}


function aiConnections(value: unknown): { connections: OpenAiConnection[]; activeConnectionId?: string } {
    const candidate = value && typeof value === "object" ? value as { connections?: unknown; activeConnectionId?: unknown } : {};
    const connections = Array.isArray(candidate.connections)
        ? candidate.connections.filter((item): item is OpenAiConnection => Boolean(item) && typeof item === "object" && (item as OpenAiConnection).provider === "openai" && typeof (item as OpenAiConnection).id === "string" && typeof (item as OpenAiConnection).label === "string" && typeof (item as OpenAiConnection).environmentVariableName === "string")
        : [];
    const activeConnectionId = typeof candidate.activeConnectionId === "string" && connections.some((connection) => connection.id === candidate.activeConnectionId) ? candidate.activeConnectionId : connections[0]?.id;
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

    return { defaultModel: typeof candidate.defaultModel === "string" ? candidate.defaultModel.trim() : "", skillOverrides };
}


function keyBindingOverrides(value: unknown): KeyBindingOverrides {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};

    const overrides: KeyBindingOverrides = {};
    for (const [commandId, binding] of Object.entries(value)) {
        if (!isKeyBindingCommandId(commandId))
            continue;

        if (binding === null) {
            overrides[commandId] = null;
            continue;
        }

        const normalized = normalizeKeyBinding(binding);
        if (normalized)
            overrides[commandId] = normalized;
    }

    return overrides;
}


function requestedKeyBindingOverrides(value: unknown): KeyBindingOverrides {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

    const overrides: KeyBindingOverrides = {};
    for (const [commandId, binding] of Object.entries(value)) {
        if (!isKeyBindingCommandId(commandId))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

        if (binding === null) {
            overrides[commandId] = null;
            continue;
        }

        const normalized = normalizeKeyBinding(binding);
        if (!normalized)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_KEY_BINDING, HTTP_STATUS.BAD_REQUEST);

        overrides[commandId] = normalized;
    }

    const conflict = findKeyBindingConflict(resolveKeyBindings(overrides));
    if (conflict)
        throw new ApplicationServiceError(APPLICATION_ERROR.KEY_BINDING_CONFLICT, HTTP_STATUS.BAD_REQUEST, { firstCommandId: conflict[0], secondCommandId: conflict[1] });

    return overrides;
}


export async function handleSettingsSnapshotRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== applicationSettingsPath || request.method !== HTTP_METHOD.GET)
        return false;

    writeJson(response, HTTP_STATUS.OK, {
        general: generalSettings(repositories.getSetting("application-general")?.value),
        systemDateTimeFormat: await readSystemDateTimeFormat(),
        ...aiConnections(repositories.getSetting("application-ai-connections")?.value),
        modelPreferences: modelPreferences(repositories.getSetting("application-model-preferences")?.value),
        backupPolicy: backupPolicy(repositories.getSetting("application-backup-policy")?.value),
        keyBindingOverrides: keyBindingOverrides(repositories.getSetting("application-key-bindings")?.value),
    });
    return true;
}


export async function handleGeneralSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== `${applicationSettingsPath}/general` || request.method !== HTTP_METHOD.PUT)
        return false;

    const value = generalSettings(object(await readJson(request)), true);
    repositories.setSetting("application-general", value);

    writeJson(response, HTTP_STATUS.OK, value);
    return true;
}


export async function handleBackupPolicyRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== `${applicationSettingsPath}/backup-policy` || request.method !== HTTP_METHOD.PUT)
        return false;

    const value = backupPolicy(object(await readJson(request)));
    repositories.setSetting("application-backup-policy", value);

    writeJson(response, HTTP_STATUS.OK, value);
    return true;
}


export async function handleKeyBindingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== keyBindingsPath || request.method !== HTTP_METHOD.PUT)
        return false;

    const value = requestedKeyBindingOverrides(object(await readJson(request)));
    repositories.setSetting("application-key-bindings", value);

    writeJson(response, HTTP_STATUS.OK, value);
    return true;
}


export async function handleModelPreferencesRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== aiModelPreferencesPath || request.method !== HTTP_METHOD.PUT)
        return false;

    const value = modelPreferences(object(await readJson(request)));
    repositories.setSetting("application-model-preferences", value);

    writeJson(response, HTTP_STATUS.OK, value);
    return true;
}


function connectionMatch(pathname: string): { connectionId: string; action?: "active" | "test" } | undefined {
    const match = new RegExp(`^${aiConnectionsPath}/([^/]+)(/(active|test))?$`).exec(pathname);
    if (!match)
        return undefined;

    return { connectionId: decodeURIComponent(match[1]!), ...(match[3] ? { action: match[3] as "active" | "test" } : {}) };
}


function connectionState(repositories: Repositories, connectionId: string) {
    const saved = aiConnections(repositories.getSetting("application-ai-connections")?.value);
    const index = saved.connections.findIndex((connection) => connection.id === connectionId);
    if (index < 0)
        throw new ApplicationServiceError(APPLICATION_ERROR.AI_CONNECTION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    return { saved, index, connection: saved.connections[index]! };
}


export async function handleCreateAiConnectionRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== aiConnectionsPath || request.method !== HTTP_METHOD.POST)
        return false;

    const body = object(await readJson(request));
    const saved = aiConnections(repositories.getSetting("application-ai-connections")?.value);
    const requestedName = environmentVariableName(body.environmentVariableName);
    if (saved.connections.some((connection) => connection.environmentVariableName === requestedName))
        throw new ApplicationServiceError(APPLICATION_ERROR.DUPLICATE_AI_CONNECTION, HTTP_STATUS.BAD_REQUEST, { environmentVariableName: requestedName });

    const connection: OpenAiConnection = { id: randomUUID(), provider: "openai", label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : "OpenAI", environmentVariableName: requestedName, status: "unchecked" };
    saved.connections.push(connection);
    repositories.setSetting("application-ai-connections", { ...saved, activeConnectionId: saved.activeConnectionId ?? connection.id });

    writeJson(response, HTTP_STATUS.CREATED, connection);
    return true;
}


export async function handleActivateAiConnectionRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    const match = connectionMatch(pathname);
    if (!match?.action || match.action !== "active" || request.method !== HTTP_METHOD.PUT)
        return false;

    const { saved } = connectionState(repositories, match.connectionId);
    repositories.setSetting("application-ai-connections", { ...saved, activeConnectionId: match.connectionId });
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

    return true;
}


export async function handleTestAiConnectionRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    const match = connectionMatch(pathname);
    if (!match?.action || match.action !== "test" || request.method !== HTTP_METHOD.POST)
        return false;

    const { saved, index, connection } = connectionState(repositories, match.connectionId);
    try {
        await listAvailableModels(connection.provider, connection.environmentVariableName);
        saved.connections[index] = { ...connection, status: "connected", lastCheckedAt: new Date().toISOString(), diagnostic: undefined };
    } catch (error) {
        saved.connections[index] = { ...connection, status: "unavailable", lastCheckedAt: new Date().toISOString(), diagnostic: error instanceof Error ? error.message : "OpenAI could not verify this connection." };
    }

    repositories.setSetting("application-ai-connections", saved);

    writeJson(response, HTTP_STATUS.OK, saved.connections[index]);
    return true;
}


export async function handleUpdateAiConnectionRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    const match = connectionMatch(pathname);
    if (!match || match.action || request.method !== HTTP_METHOD.PUT)
        return false;

    const { saved, index, connection } = connectionState(repositories, match.connectionId);
    const body = object(await readJson(request));
    const updated = { ...connection, label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : connection.label, environmentVariableName: environmentVariableName(body.environmentVariableName), status: "unchecked" as const, diagnostic: undefined, lastCheckedAt: undefined };
    saved.connections[index] = updated;
    repositories.setSetting("application-ai-connections", saved);

    writeJson(response, HTTP_STATUS.OK, updated);
    return true;
}


export async function handleDeleteAiConnectionRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    const match = connectionMatch(pathname);
    if (!match || match.action || request.method !== HTTP_METHOD.DELETE)
        return false;

    const { saved, index } = connectionState(repositories, match.connectionId);
    if (saved.activeConnectionId === match.connectionId)
        throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REMOVAL_BLOCKED, HTTP_STATUS.BAD_REQUEST);

    saved.connections.splice(index, 1);
    repositories.setSetting("application-ai-connections", { connections: saved.connections, ...(saved.connections[0] ? { activeConnectionId: saved.connections[0].id } : {}) });
    response.writeHead(HTTP_STATUS.NO_CONTENT);
    response.end();

    return true;
}


export async function handleAiConnectionsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (await handleCreateAiConnectionRoute(request, response, pathname, repositories))
        return true;

    if (await handleActivateAiConnectionRoute(request, response, pathname, repositories))
        return true;

    if (await handleTestAiConnectionRoute(request, response, pathname, repositories))
        return true;

    if (await handleUpdateAiConnectionRoute(request, response, pathname, repositories))
        return true;

    return handleDeleteAiConnectionRoute(request, response, pathname, repositories);
}


export async function handleAiModelsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname !== aiModelsPath || request.method !== HTTP_METHOD.POST)
        return false;

    const saved = aiConnections(repositories.getSetting("application-ai-connections")?.value);
    const active = saved.connections.find((connection) => connection.id === saved.activeConnectionId);
    if (!active)
        throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REQUIRED, HTTP_STATUS.BAD_REQUEST);

    writeJson(response, HTTP_STATUS.OK, await listAvailableModels(active.provider, active.environmentVariableName));
    return true;
}


export async function handleSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (await handleSettingsSnapshotRoute(request, response, pathname, repositories))
        return true;

    if (await handleGeneralSettingsRoute(request, response, pathname, repositories))
        return true;

    if (await handleBackupPolicyRoute(request, response, pathname, repositories))
        return true;

    if (await handleKeyBindingsRoute(request, response, pathname, repositories))
        return true;

    if (await handleModelPreferencesRoute(request, response, pathname, repositories))
        return true;

    if (await handleAiConnectionsRoute(request, response, pathname, repositories))
        return true;

    return handleAiModelsRoute(request, response, pathname, repositories);
}
