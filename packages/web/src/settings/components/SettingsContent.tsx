import type { AiConnection, AiProvider, AppModelPreference, ApplicationSettingsSnapshot, AvailableAiModel, BackupPolicy, DesktopTelemetryClient, GeneralSettings, KeyBindingOverrides, ModelPreferences, PublishingSettings } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../../application-client.js";
import { AboutSettingsSection } from "./AboutSettingsSection.js";
import { AiSettingsSection } from "./AiSettingsSection.js";
import { DataBackupsSettingsSection } from "./DataBackupsSettingsSection.js";
import { GeneralSettingsSection } from "./GeneralSettingsSection.js";
import { KeyBindingSettings } from "./KeyBindingSettings.js";
import { PublishingSettingsSection } from "./PublishingSettingsSection.js";
import { settingsSections, type SettingsSection } from "../settings-sections.js";
import { useIntl } from "react-intl";


export function SettingsContent({ client, section, settings, general, preferences, appModel, backupPolicy, keyBindingOverrides, publishingSettings, models, connectionProvider, connectionName, environmentName, managedConnectionName, apiKey, connectionError, desktopAvailable, telemetry, onThemeApplied, setConnectionProvider, setConnectionName, setEnvironmentName, setManagedConnectionName, setApiKey, saveGeneral, savePreferences, saveAppModel, saveBackupPolicy, saveKeyBindingOverrides, savePublishingSettings, addConnection, addManagedConnection, setConnectionActive, requestConnectionRename, requestConnectionRemoval, refreshModels }: {
    client: EditorialWorkspaceClient;
    section: SettingsSection;
    settings: ApplicationSettingsSnapshot | undefined;
    general: GeneralSettings;
    preferences: ModelPreferences;
    appModel?: AppModelPreference;
    backupPolicy: BackupPolicy;
    keyBindingOverrides: KeyBindingOverrides;
    publishingSettings: PublishingSettings;
    models: AvailableAiModel[];
    connectionProvider: AiProvider;
    connectionName: string;
    environmentName: string;
    managedConnectionName: string;
    apiKey: string;
    connectionError: string | undefined;
    desktopAvailable: boolean;
    telemetry?: DesktopTelemetryClient;
    onThemeApplied: ((theme: GeneralSettings["theme"]) => void) | undefined;
    setConnectionProvider: (value: AiProvider) => void;
    setConnectionName: (value: string) => void;
    setEnvironmentName: (value: string) => void;
    setManagedConnectionName: (value: string) => void;
    setApiKey: (value: string) => void;
    saveGeneral: (next: GeneralSettings) => Promise<void>;
    savePreferences: (next: ModelPreferences) => Promise<void>;
    saveAppModel: (next: AppModelPreference | null) => Promise<void>;
    saveBackupPolicy: (next: BackupPolicy) => Promise<void>;
    saveKeyBindingOverrides: (next: KeyBindingOverrides) => Promise<void>;
    savePublishingSettings: (next: PublishingSettings) => void;
    addConnection: () => void;
    addManagedConnection: (() => void) | undefined;
    setConnectionActive: (connectionId: string, active: boolean) => void;
    requestConnectionRename: (connection: AiConnection) => void;
    requestConnectionRemoval: (connection: AiConnection) => void;
    refreshModels: () => void;
}) {
    const intl = useIntl();
    let content = <DataBackupsSettingsSection client={client} backupPolicy={backupPolicy} save={saveBackupPolicy} />;

    if (settings && section === "general")
        content = <GeneralSettingsSection general={general} save={saveGeneral} applyTheme={onThemeApplied} telemetry={telemetry} />;
    else if (settings && section === "keyBindings")
        content = <KeyBindingSettings general={general} saveGeneral={saveGeneral} overrides={keyBindingOverrides} save={saveKeyBindingOverrides} />;
    else if (settings && section === "ai")
        content = <AiSettingsSection settings={settings} preferences={preferences} appModel={appModel} models={models} connectionProvider={connectionProvider} connectionName={connectionName} environmentName={environmentName} managedConnectionName={managedConnectionName} apiKey={apiKey} connectionError={connectionError} setConnectionProvider={setConnectionProvider} setConnectionName={setConnectionName} setEnvironmentName={setEnvironmentName} setManagedConnectionName={setManagedConnectionName} setApiKey={setApiKey} onAddConnection={addConnection} onAddManagedConnection={addManagedConnection} onSetConnectionActive={setConnectionActive} onRequestConnectionRename={requestConnectionRename} canRenameManagedConnection={desktopAvailable} onRequestConnectionRemoval={requestConnectionRemoval} onRefreshModels={refreshModels} savePreferences={savePreferences} saveAppModel={saveAppModel} />;
    else if (settings && section === "publishing")
        content = <PublishingSettingsSection publishing={publishingSettings} save={savePublishingSettings} general={general} saveGeneral={saveGeneral} />;
    else if (settings && section === "about")
        content = <AboutSettingsSection />;

    return <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
            <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: settingsSections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
            {settings ? content : null}
        </div>
    </section>;
}
