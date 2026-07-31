import type { IncomingMessage, ServerResponse } from "node:http";
import { applicationSettingsPath, defaultGeneralSettings, HTTP_METHOD, HTTP_STATUS, type BackupPolicy, type GeneralSettings } from "@skladno/shared";
import { Repositories } from "../../persistence/index.js";
import { object, readJson, writeJson } from "../json.js";

const generalKey = "application-general";
const backupKey = "application-backup-policy";

function general(value: unknown): GeneralSettings {
    const candidate = value && typeof value === "object" ? value as Partial<GeneralSettings> : {};
    return {
        ...defaultGeneralSettings,
        ...candidate,
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

export async function handleSettingsRoute(request: IncomingMessage, response: ServerResponse, pathname: string, repositories: Repositories): Promise<boolean> {
    if (pathname === applicationSettingsPath && request.method === HTTP_METHOD.GET) {
        writeJson(response, HTTP_STATUS.OK, {
            general: general(repositories.getSetting(generalKey)?.value),
            connections: [],
            modelPreferences: { defaultModel: "", operationOverrides: {} },
            backupPolicy: backup(repositories.getSetting(backupKey)?.value),
        });

        return true;
    }

    if (pathname === `${applicationSettingsPath}/general` && request.method === HTTP_METHOD.PUT) {
        const value = general(object(await readJson(request)));
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

    return false;
}
