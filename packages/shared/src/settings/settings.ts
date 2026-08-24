import type { BuiltInSkillId } from "../assistant/assistant.js";
import type { KeyBindingOverrides } from "../cross-cutting/key-bindings.js";

export const applicationSettingsPath = "/api/settings";
export const aiConnectionsPath = `${applicationSettingsPath}/ai/connections`;
export const aiModelsPath = `${applicationSettingsPath}/ai/models`;
export const aiModelPreferencesPath = `${applicationSettingsPath}/ai/model-preferences`;
export const keyBindingsPath = `${applicationSettingsPath}/key-bindings`;
export const backupsPath = `${applicationSettingsPath}/backups`;

export type ApplicationScreen = "editorial-workspace" | "application-settings";
export const INTERFACE_LOCALE = {
    EN: "en",
} as const;

export type InterfaceLocale = typeof INTERFACE_LOCALE[keyof typeof INTERFACE_LOCALE];
export const defaultInterfaceLocale: InterfaceLocale = INTERFACE_LOCALE.EN;
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type DateFormatPreference = "system" | "day-first" | "day-first-dots" | "month-first" | "iso";
export type TimeFormatPreference = "system" | "12-hour" | "24-hour";
export type TimeZonePreference = "system" | string;
export type AssistantSendMode = "enter" | "ctrl-enter";


export function isDateFormatPreference(value: unknown): value is DateFormatPreference {
    return value === "system"
        || value === "day-first"
        || value === "day-first-dots"
        || value === "month-first"
        || value === "iso";
}


export function isThemePreference(value: unknown): value is ThemePreference {
    return value === "system" || value === "light" || value === "dark";
}


export function resolveTheme(theme: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
    return theme === "system" ? systemTheme : theme;
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
    assistantSendMode: AssistantSendMode;
    defaultArticleLanguage: string;
    defaultTranslationLanguages: string[];
}


export interface SystemDateTimeFormat {
    locale?: string;
    datePattern?: string;
    timePattern?: string;
}


export type CredentialSource =
    | { kind: "environment-variable"; environmentVariableName: string }
    | { kind: "managed" };


export interface AiConnection {
    id: string;
    provider: string;
    label: string;
    credentialSource: CredentialSource;
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
    schedule: "off" | "daily";
    retention: { mode: "count"; count: number } | { mode: "unlimited" };
}


export interface ApplicationSettingsSnapshot {
    general: GeneralSettings;
    systemDateTimeFormat?: SystemDateTimeFormat;
    connections: AiConnection[];
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
    assistantSendMode: "enter",
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
    /** Available only in the web client, where the browser writes to the author-selected folder. */
    createBackup?(): Promise<Blob>;
    updateKeyBindingOverrides(input: KeyBindingOverrides): Promise<KeyBindingOverrides>;
    addAiConnection(input: { label: string; environmentVariableName: string }): Promise<AiConnection>;
    updateAiConnection(connectionId: string, input: { label: string; environmentVariableName: string }): Promise<AiConnection>;
    removeAiConnection(connectionId: string): Promise<void>;
    setActiveAiConnection(connectionId: string): Promise<void>;
    testAiConnection(connectionId: string): Promise<AiConnection>;
    refreshAiModels(): Promise<string[]>;
    updateModelPreferences(input: ModelPreferences): Promise<ModelPreferences>;
}


export function isAssistantSendMode(value: unknown): value is AssistantSendMode {
    return value === "enter" || value === "ctrl-enter";
}


export interface DesktopSettingsLocations {
    dataDirectory: string;
    backupDirectory?: string;
    dataDirectoryExternallyControlled: boolean;
}


/** Context-isolated, finite native Settings operations. Paths are never supplied by the renderer. */
export interface DesktopSettingsClient {
    getLocations(): Promise<DesktopSettingsLocations>;
    chooseBackupDirectory(): Promise<string | undefined>;
    revealBackupDirectory(): Promise<void>;
    revealDataDirectory(): Promise<void>;
    createNativeBackup(): Promise<{ path: string; createdAt: string }>;
    addManagedAiConnection(input: { label: string; apiKey: string }): Promise<AiConnection>;
    renameManagedAiConnection(connectionId: string, label: string): Promise<AiConnection>;
    removeManagedAiConnection(connectionId: string): Promise<void>;
}
