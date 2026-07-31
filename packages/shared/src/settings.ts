import type { EditorialOperation } from "./editorial.js";

export const applicationSettingsPath = "/api/settings";
export const aiConnectionsPath = `${applicationSettingsPath}/ai/connections`;
export const aiModelsPath = `${applicationSettingsPath}/ai/models`;
export const aiModelPreferencesPath = `${applicationSettingsPath}/ai/model-preferences`;

export type ApplicationScreen = "editorial-workspace" | "application-settings";
export const INTERFACE_LOCALE = {
    EN: "en",
} as const;

export type InterfaceLocale = typeof INTERFACE_LOCALE[keyof typeof INTERFACE_LOCALE];
export const defaultInterfaceLocale: InterfaceLocale = INTERFACE_LOCALE.EN;
export type ThemePreference = "system" | "light" | "dark";
export type DateFormatPreference = "system" | "day-first" | "month-first" | "iso";
export type TimeFormatPreference = "system" | "12-hour" | "24-hour";

export interface GeneralSettings {
    theme: ThemePreference;
    interfaceLocale: InterfaceLocale;
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
    interfaceLocale: defaultInterfaceLocale,
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
    addOpenAiConnection(input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection>;
    updateOpenAiConnection(connectionId: string, input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection>;
    removeOpenAiConnection(connectionId: string): Promise<void>;
    setActiveOpenAiConnection(connectionId: string): Promise<void>;
    testOpenAiConnection(connectionId: string): Promise<OpenAiConnection>;
    refreshOpenAiModels(): Promise<string[]>;
    updateModelPreferences(input: ModelPreferences): Promise<ModelPreferences>;
}
