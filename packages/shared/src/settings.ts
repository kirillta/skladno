import type { EditorialOperation } from "./editorial.js";

export const applicationSettingsPath = "/api/settings";

export type ApplicationScreen = "editorial-workspace" | "application-settings";
export type ThemePreference = "system" | "light" | "dark";
export type DateFormatPreference = "system" | "day-first" | "month-first" | "iso";
export type TimeFormatPreference = "system" | "12-hour" | "24-hour";

export interface GeneralSettings {
    theme: ThemePreference;
    interfaceLocale: "en";
    dateFormat: DateFormatPreference;
    timeFormat: TimeFormatPreference;
    defaultArticleLanguage: string;
    defaultTranslationLanguages: string[];
}

export interface OpenAiConnection {
    id: string;
    provider: "openai";
    label: string;
    environmentVariableName: string;
    status: "unchecked" | "connected" | "unavailable";
    lastCheckedAt?: string;
    diagnostic?: string;
}

export interface ModelPreferences {
    defaultModel: string;
    operationOverrides: Partial<Record<EditorialOperation, string>>;
}

export interface BackupPolicy {
    destinationPath?: string;
    schedule: "off" | "daily";
    retention: { mode: "count"; count: number } | { mode: "unlimited" };
}

export interface ApplicationSettingsSnapshot {
    general: GeneralSettings;
    connections: OpenAiConnection[];
    activeConnectionId?: string;
    modelPreferences: ModelPreferences;
    backupPolicy: BackupPolicy;
}

export const defaultGeneralSettings: GeneralSettings = {
    theme: "system",
    interfaceLocale: "en",
    dateFormat: "system",
    timeFormat: "system",
    defaultArticleLanguage: "en",
    defaultTranslationLanguages: [],
};

export interface DirectorySelectionClient {
    chooseBackupDirectory?(): Promise<string | undefined>;
}

export interface ApplicationSettingsClient {
    getApplicationSettings(): Promise<ApplicationSettingsSnapshot>;
    updateGeneralSettings(input: GeneralSettings): Promise<GeneralSettings>;
    updateBackupPolicy(input: BackupPolicy): Promise<BackupPolicy>;
}
