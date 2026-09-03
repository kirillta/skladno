import type { AiConnection, ApplicationSettingsSnapshot, BackupPolicy, GeneralSettings, KeyBindingOverrides, ModelPreferences, PublishingSettings } from "@skladno/shared";

import type { EditorialWorkspaceClient } from "../../application-client.js";
import { AiSettingsSection } from "./AiSettingsSection.js";
import { DataBackupsSettingsSection } from "./DataBackupsSettingsSection.js";
import { GeneralSettingsSection } from "./GeneralSettingsSection.js";
import { KeyBindingSettings } from "./KeyBindingSettings.js";
import { PublishingSettingsSection } from "./PublishingSettingsSection.js";
import { settingsSections, type SettingsSection } from "../settings-sections.js";
import { useIntl } from "react-intl";


export function SettingsContent({ client, section, settings, general, preferences, backupPolicy, keyBindingOverrides, publishingSettings, models, connectionName, environmentName, managedConnectionName, apiKey, connectionError, desktopAvailable, onThemeApplied, setConnectionName, setEnvironmentName, setManagedConnectionName, setApiKey, saveGeneral, savePreferences, saveBackupPolicy, saveKeyBindingOverrides, savePublishingSettings, addConnection, addManagedConnection, setActiveConnection, requestConnectionRename, requestConnectionRemoval, refreshModels }: {
    client: EditorialWorkspaceClient;
    section: SettingsSection;
    settings: ApplicationSettingsSnapshot | undefined;
    general: GeneralSettings;
    preferences: ModelPreferences;
    backupPolicy: BackupPolicy;
    keyBindingOverrides: KeyBindingOverrides;
    publishingSettings: PublishingSettings;
    models: string[];
    connectionName: string;
    environmentName: string;
    managedConnectionName: string;
    apiKey: string;
    connectionError: string | undefined;
    desktopAvailable: boolean;
    onThemeApplied: ((theme: GeneralSettings["theme"]) => void) | undefined;
    setConnectionName: (value: string) => void;
    setEnvironmentName: (value: string) => void;
    setManagedConnectionName: (value: string) => void;
    setApiKey: (value: string) => void;
    saveGeneral: (next: GeneralSettings) => Promise<void>;
    savePreferences: (next: ModelPreferences) => Promise<void>;
    saveBackupPolicy: (next: BackupPolicy) => Promise<void>;
    saveKeyBindingOverrides: (next: KeyBindingOverrides) => Promise<void>;
    savePublishingSettings: (next: PublishingSettings) => void;
    addConnection: () => void;
    addManagedConnection: (() => void) | undefined;
    setActiveConnection: (connectionId: string) => void;
    requestConnectionRename: (connection: AiConnection) => void;
    requestConnectionRemoval: (connection: AiConnection) => void;
    refreshModels: () => void;
}) {
    const intl = useIntl();
    let content = <DataBackupsSettingsSection client={client} backupPolicy={backupPolicy} save={saveBackupPolicy} />;

    if (settings && section === "general")
        content = <GeneralSettingsSection general={general} save={saveGeneral} applyTheme={onThemeApplied} />;
    else if (settings && section === "keyBindings")
        content = <KeyBindingSettings general={general} saveGeneral={saveGeneral} overrides={keyBindingOverrides} save={saveKeyBindingOverrides} />;
    else if (settings && section === "ai")
        content = <AiSettingsSection settings={settings} preferences={preferences} models={models} connectionName={connectionName} environmentName={environmentName} managedConnectionName={managedConnectionName} apiKey={apiKey} connectionError={connectionError} setConnectionName={setConnectionName} setEnvironmentName={setEnvironmentName} setManagedConnectionName={setManagedConnectionName} setApiKey={setApiKey} onAddConnection={addConnection} onAddManagedConnection={addManagedConnection} onSetActiveConnection={setActiveConnection} onRequestConnectionRename={requestConnectionRename} canRenameManagedConnection={desktopAvailable} onRequestConnectionRemoval={requestConnectionRemoval} onRefreshModels={refreshModels} savePreferences={savePreferences} />;
    else if (settings && section === "publishing")
        content = <PublishingSettingsSection publishing={publishingSettings} save={savePublishingSettings} general={general} saveGeneral={saveGeneral} />;

    return <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
            <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: settingsSections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
            {settings ? content : null}
        </div>
    </section>;
}
