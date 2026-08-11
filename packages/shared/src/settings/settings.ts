import type { BuiltInSkillId } from "../assistant/assistant.js";
import type { KeyBindingOverrides } from "../cross-cutting/key-bindings.js";

export const applicationSettingsPath = "/api/settings";
export const aiConnectionsPath = `${applicationSettingsPath}/ai/connections`;
export const aiModelsPath = `${applicationSettingsPath}/ai/models`;
export const aiModelPreferencesPath = `${applicationSettingsPath}/ai/model-preferences`;
export const keyBindingsPath = `${applicationSettingsPath}/key-bindings`;

export type ApplicationScreen = "editorial-workspace" | "application-settings";
export const INTERFACE_LOCALE = {
    EN: "en",
} as const;

export type InterfaceLocale = typeof INTERFACE_LOCALE[keyof typeof INTERFACE_LOCALE];
export const defaultInterfaceLocale: InterfaceLocale = INTERFACE_LOCALE.EN;
export type ThemePreference = "system" | "light" | "dark";
export type DateFormatPreference = "system" | "day-first" | "day-first-dots" | "month-first" | "iso";
export type TimeFormatPreference = "system" | "12-hour" | "24-hour";
export type TimeZonePreference = "system" | string;


export function isDateFormatPreference(value: unknown): value is DateFormatPreference {
    return value === "system"
        || value === "day-first"
        || value === "day-first-dots"
        || value === "month-first"
        || value === "iso";
}


export function isTimeFormatPreference(value: unknown): value is TimeFormatPreference {
    return value === "system" || value === "12-hour" || value === "24-hour";
}


export function isTimeZonePreference(value: unknown): value is TimeZonePreference {
    if (value === "system")
        return true;

    if (typeof value !== "string" || !value)
        return false;

    try {
        const resolved = new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;

        return resolved === "UTC" || resolved.includes("/");
    } catch {
        return false;
    }
}

export interface GeneralSettings {
    theme: ThemePreference;
    interfaceLocale: InterfaceLocale;
    dateFormat: DateFormatPreference;
    timeFormat: TimeFormatPreference;
    timeZone: TimeZonePreference;
    defaultArticleLanguage: string;
    defaultTranslationLanguages: string[];
}

export interface SystemDateTimeFormat {
    locale?: string;
    datePattern?: string;
    timePattern?: string;
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
    textGenerationModel?: string;
    skillOverrides: Partial<Record<BuiltInSkillId, string>>;
}

export interface BackupPolicy {
    destinationPath?: string;
    schedule: "off" | "daily";
    retention: { mode: "count"; count: number } | { mode: "unlimited" };
}

export interface ApplicationSettingsSnapshot {
    general: GeneralSettings;
    systemDateTimeFormat?: SystemDateTimeFormat;
    connections: OpenAiConnection[];
    activeConnectionId?: string;
    modelPreferences: ModelPreferences;
    backupPolicy: BackupPolicy;
    keyBindingOverrides: KeyBindingOverrides;
}

export const defaultGeneralSettings: GeneralSettings = {
    theme: "system",
    interfaceLocale: defaultInterfaceLocale,
    dateFormat: "system",
    timeFormat: "system",
    timeZone: "system",
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
    updateKeyBindingOverrides(input: KeyBindingOverrides): Promise<KeyBindingOverrides>;
    addOpenAiConnection(input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection>;
    updateOpenAiConnection(connectionId: string, input: Pick<OpenAiConnection, "label" | "environmentVariableName">): Promise<OpenAiConnection>;
    removeOpenAiConnection(connectionId: string): Promise<void>;
    setActiveOpenAiConnection(connectionId: string): Promise<void>;
    testOpenAiConnection(connectionId: string): Promise<OpenAiConnection>;
    refreshOpenAiModels(): Promise<string[]>;
    updateModelPreferences(input: ModelPreferences): Promise<ModelPreferences>;
}
