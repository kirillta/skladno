import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { APPLICATION_ERROR, aiConnectionsPath, aiModelPreferencesPath, aiModelsPath, applicationSettingsPath, defaultGeneralSettings, defaultInterfaceLocale, findKeyBindingConflict, HTTP_METHOD, HTTP_STATUS, INTERFACE_LOCALE, isKeyBindingCommandId, isTimeZonePreference, keyBindingsPath, normalizeKeyBinding, resolveKeyBindings, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";
import { Repositories } from "../../persistence/index.js";
import { object, readJson, writeJson } from "../json.js";
import { ApplicationServiceError } from "../application-error.js";

const generalKey = "application-general";
const backupKey = "application-backup-policy";
const aiConnectionsKey = "application-ai-connections";
const modelPreferencesKey = "application-model-preferences";
const keyBindingsKey = "application-key-bindings";

function general(value: unknown, rejectInvalidTimeZone = false): GeneralSettings {
    const candidate = value && typeof value === "object" ? value as Partial<GeneralSettings> : {};
    if (rejectInvalidTimeZone && candidate.timeZone !== undefined && !isTimeZonePreference(candidate.timeZone))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

    return {
        ...defaultGeneralSettings,
        ...candidate,
        interfaceLocale: candidate.interfaceLocale === INTERFACE_LOCALE.EN ? candidate.interfaceLocale : defaultInterfaceLocale,
        timeZone: isTimeZonePreference(candidate.timeZone) ? candidate.timeZone : defaultGeneralSettings.timeZone,
        defaultTranslationLanguages: Array.isArray(candidate.defaultTranslationLanguages)
            ? [...new Set(candidate.defaultTranslationLanguages.filter((language): language is string => typeof language === "string" && language !== candidate.defaultArticleLanguage))]
            : [],
    };
}

function backup(value: unknown): BackupPolicy {
    const candidate = value && typeof value === "object" ? value as Partial<BackupPolicy> : {};
    return {
        destinationPath: typeof candidate.destinationPath === "string" ? candidate.destinationPath : undefined,
        schedule: candidate.schedule === "daily" ? "daily" : "off",
        retention: candidate.retention?.mode === "unlimited"
            ? { mode: "unlimited" }
            : { mode: "count", count: Math.min(365, Math.max(1, candidate.retention?.mode === "count" ? candidate.retention.count : 7)) },
    };
}

function environmentVariableName(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(value))
        throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_ENVIRONMENT_VARIABLE_NAME, HTTP_STATUS.BAD_REQUEST);

    return value;
}

function connections(value: unknown): { connections: OpenAiConnection[]; activeConnectionId?: string } {
    const candidate = value && typeof value === "object" ? value as { connections?: unknown; activeConnectionId?: unknown } : {};
    const items = Array.isArray(candidate.connections) ? candidate.connections.filter((item): item is OpenAiConnection => Boolean(item) && typeof item === "object" && (item as OpenAiConnection).provider === "openai" && typeof (item as OpenAiConnection).id === "string" && typeof (item as OpenAiConnection).label === "string" && typeof (item as OpenAiConnection).environmentVariableName === "string") : [];
    const activeConnectionId = typeof candidate.activeConnectionId === "string" && items.some((item) => item.id === candidate.activeConnectionId) ? candidate.activeConnectionId : items[0]?.id;

    return { connections: items, ...(activeConnectionId ? { activeConnectionId } : {}) };
}

function modelPreferences(value: unknown): ModelPreferences {
    const candidate = value && typeof value === "object" ? value as Partial<ModelPreferences> : {};
    const operationOverrides = candidate.operationOverrides && typeof candidate.operationOverrides === "object" ? Object.fromEntries(Object.entries(candidate.operationOverrides).filter(([operation, model]) => typeof operation === "string" && typeof model === "string")) : {};

    return { defaultModel: typeof candidate.defaultModel === "string" ? candidate.defaultModel.trim() : "", operationOverrides };
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

async function listModels(environmentVariable: string): Promise<string[]> {
    const apiKey = process.env[environmentVariable];
    if (!apiKey)
        throw new ApplicationServiceError(APPLICATION_ERROR.ENVIRONMENT_VARIABLE_UNAVAILABLE, HTTP_STATUS.BAD_REQUEST, { environmentVariableName: environmentVariable });

    const response = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
    if (!response.ok)
        throw new ApplicationServiceError(APPLICATION_ERROR.OPENAI_CONNECTION_VERIFICATION_FAILED, HTTP_STATUS.BAD_REQUEST);

    const body = await response.json() as { data?: { id?: unknown }[] };
    return (body.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string" && !/(embedding|moderation|image|audio|transcri|speech|realtime)/i.test(id)).sort();
}

export async function handleSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname === applicationSettingsPath && request.method === HTTP_METHOD.GET) {
        writeJson(response, HTTP_STATUS.OK, {
            general: general(repositories.getSetting(generalKey)?.value),
            ...connections(repositories.getSetting(aiConnectionsKey)?.value),
            modelPreferences: modelPreferences(repositories.getSetting(modelPreferencesKey)?.value),
            backupPolicy: backup(repositories.getSetting(backupKey)?.value),
            keyBindingOverrides: keyBindingOverrides(repositories.getSetting(keyBindingsKey)?.value),
        });

        return true;
    }

    if (pathname === `${applicationSettingsPath}/general` && request.method === HTTP_METHOD.PUT) {
        const value = general(object(await readJson(request)), true);
        repositories.setSetting(generalKey, value);

        writeJson(response, HTTP_STATUS.OK, value);
        return true;
    }

    if (pathname === `${applicationSettingsPath}/backup-policy` && request.method === HTTP_METHOD.PUT) {
        const value = backup(object(await readJson(request)));
        repositories.setSetting(backupKey, value);

        writeJson(response, HTTP_STATUS.OK, value);
        return true;
    }

    if (pathname === keyBindingsPath && request.method === HTTP_METHOD.PUT) {
        const value = requestedKeyBindingOverrides(object(await readJson(request)));
        repositories.setSetting(keyBindingsKey, value);

        writeJson(response, HTTP_STATUS.OK, value);
        return true;
    }

    if (pathname === aiConnectionsPath && request.method === HTTP_METHOD.POST) {
        const body = object(await readJson(request));
        const saved = connections(repositories.getSetting(aiConnectionsKey)?.value);
        const connection: OpenAiConnection = { id: randomUUID(), provider: "openai", label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : "OpenAI", environmentVariableName: environmentVariableName(body.environmentVariableName), status: "unchecked" };
        saved.connections.push(connection);
        repositories.setSetting(aiConnectionsKey, { ...saved, activeConnectionId: saved.activeConnectionId ?? connection.id });
        writeJson(response, HTTP_STATUS.CREATED, connection);
        return true;
    }

    const connectionMatch = new RegExp(`^${aiConnectionsPath}/([^/]+)(/(active|test))?$`).exec(pathname);
    if (connectionMatch) {
        const connectionId = decodeURIComponent(connectionMatch[1]!);
        const action = connectionMatch[3];
        const saved = connections(repositories.getSetting(aiConnectionsKey)?.value);
        const index = saved.connections.findIndex((connection) => connection.id === connectionId);
        if (index < 0)
            throw new ApplicationServiceError(APPLICATION_ERROR.OPENAI_CONNECTION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        if (action === "active" && request.method === HTTP_METHOD.PUT) {
            repositories.setSetting(aiConnectionsKey, { ...saved, activeConnectionId: connectionId });
            response.writeHead(HTTP_STATUS.NO_CONTENT);
            response.end();
            return true;
        }

        if (action === "test" && request.method === HTTP_METHOD.POST) {
            const connection = saved.connections[index]!;
            try {
                await listModels(connection.environmentVariableName);
                saved.connections[index] = { ...connection, status: "connected", lastCheckedAt: new Date().toISOString(), diagnostic: undefined };
            } catch (error) {
                saved.connections[index] = { ...connection, status: "unavailable", lastCheckedAt: new Date().toISOString(), diagnostic: error instanceof Error ? error.message : "OpenAI could not verify this connection." };
            }

            repositories.setSetting(aiConnectionsKey, saved);
            writeJson(response, HTTP_STATUS.OK, saved.connections[index]);
            return true;
        }

        if (!action && request.method === HTTP_METHOD.PUT) {
            const body = object(await readJson(request));
            const existing = saved.connections[index]!;
            const updated = { ...existing, label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : existing.label, environmentVariableName: environmentVariableName(body.environmentVariableName), status: "unchecked" as const, diagnostic: undefined, lastCheckedAt: undefined };
            saved.connections[index] = updated;
            repositories.setSetting(aiConnectionsKey, saved);
            writeJson(response, HTTP_STATUS.OK, updated);
            return true;
        }

        if (!action && request.method === HTTP_METHOD.DELETE) {
            if (saved.activeConnectionId === connectionId && saved.connections.length > 1)
                throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REMOVAL_BLOCKED, HTTP_STATUS.BAD_REQUEST);

            saved.connections.splice(index, 1);
            repositories.setSetting(aiConnectionsKey, { connections: saved.connections, ...(saved.connections[0] ? { activeConnectionId: saved.connections[0].id } : {}) });
            response.writeHead(HTTP_STATUS.NO_CONTENT);
            response.end();
            return true;
        }
    }

    if (pathname === aiModelsPath && request.method === HTTP_METHOD.POST) {
        const saved = connections(repositories.getSetting(aiConnectionsKey)?.value);
        const active = saved.connections.find((connection) => connection.id === saved.activeConnectionId);
        if (!active)
            throw new ApplicationServiceError(APPLICATION_ERROR.ACTIVE_CONNECTION_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        writeJson(response, HTTP_STATUS.OK, await listModels(active.environmentVariableName));
        return true;
    }

    if (pathname === aiModelPreferencesPath && request.method === HTTP_METHOD.PUT) {
        const value = modelPreferences(object(await readJson(request)));
        repositories.setSetting(modelPreferencesKey, value);
        writeJson(response, HTTP_STATUS.OK, value);
        return true;
    }

    return false;
}
