import { useEffect, useState } from "react";
import { defaultGeneralSettings, defaultPublishingSettings, type AiConnection, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type PublishingSettings } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { useIntl } from "react-intl";
import { useNotifications } from "../notifications/NotificationProvider.js";
import { AiSettingsSection } from "./components/AiSettingsSection.js";
import { getDesktopSettingsClient } from "../desktop-client.js";
import { ConnectionRemovalDialog } from "./components/ConnectionRemovalDialog.js";
import { ManagedConnectionRenameDialog } from "./components/ManagedConnectionRenameDialog.js";
import { DataBackupsSettingsSection } from "./components/DataBackupsSettingsSection.js";
import { GeneralSettingsSection } from "./components/GeneralSettingsSection.js";
import { KeyBindingSettings } from "./components/KeyBindingSettings.js";
import { PublishingSettingsSection } from "./components/PublishingSettingsSection.js";
import { SettingsNavigation } from "./components/SettingsNavigation.js";
import { settingsSections, type SettingsSection } from "./settings-sections.js";


export function ApplicationSettings({ client, back, onKeyBindingsUpdated, onThemeApplied }: { client: EditorialWorkspaceClient; back: () => void; onKeyBindingsUpdated?: (overrides: KeyBindingOverrides) => void; onThemeApplied?: (theme: GeneralSettings["theme"]) => void }) {
    const intl = useIntl();
    const { notify, notifyError } = useNotifications();
    const [section, setSection] = useState<SettingsSection>("general");
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", skillOverrides: {} });
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>({});
    const [publishingSettings, setPublishingSettings] = useState<PublishingSettings>(defaultPublishingSettings);
    const [models, setModels] = useState<string[]>([]);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
    const [managedConnectionName, setManagedConnectionName] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [connectionError, setConnectionError] = useState<string>();
    const [connectionPendingRemoval, setConnectionPendingRemoval] = useState<AiConnection>();
    const [connectionPendingRename, setConnectionPendingRename] = useState<AiConnection>();
    const [renamedConnectionLabel, setRenamedConnectionLabel] = useState("");
    const [status, setStatus] = useState(() => intl.formatMessage({ id: "settings.loading" }));
    const desktopSettings = getDesktopSettingsClient();

    useEffect(() => {
        void client.getApplicationSettings().then((loaded) => {
            setSettings(loaded);
            setGeneral(loaded.general);
            setPreferences(loaded.modelPreferences);
            setBackupPolicy(loaded.backupPolicy);
            setKeyBindingOverrides(loaded.keyBindingOverrides);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        }).catch((error) => {
            setStatus(intl.formatMessage({ id: "settings.loadingFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.loadingFailed" }) });
        });
        void client.getPublishingSettings().then(setPublishingSettings).catch((error) => notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.loadingFailed" }) }));
    }, [client, intl, notifyError]);

    useEffect(() => {
        if (section !== "ai" || !settings?.activeConnectionId)
            return;

        void client.refreshAiModels().then(setModels).catch((error) => {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        });
    }, [client, intl, notifyError, section, settings?.activeConnectionId]);


    async function saveGeneral(next: GeneralSettings) {
        setGeneral(next);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.updateGeneralSettings(next);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notify({ tone: "error", title: intl.formatMessage({ id: "settings.saveFailed" }) });
        }
    }


    async function savePreferences(next: ModelPreferences) {
        setPreferences(next);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.updateModelPreferences(next);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch {
            setStatus(intl.formatMessage({ id: "settings.modelSaveFailed" }));
            notify({ tone: "error", title: intl.formatMessage({ id: "settings.modelSaveFailed" }) });
        }
    }


    async function saveBackupPolicy(next: BackupPolicy) {
        setBackupPolicy(next);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.updateBackupPolicy(next);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch {
            setStatus(intl.formatMessage({ id: "settings.backupSaveFailed" }));
            notify({ tone: "error", title: intl.formatMessage({ id: "settings.backupSaveFailed" }) });
        }
    }


    async function saveKeyBindingOverrides(next: KeyBindingOverrides) {
        setKeyBindingOverrides(next);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.updateKeyBindingOverrides(next);
            onKeyBindingsUpdated?.(next);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.saveFailed" }) });
            throw error;
        }
    }


    async function addConnection() {
        if (settings?.connections.some((connection) => (connection.credentialSource?.kind === "environment-variable" ? connection.credentialSource.environmentVariableName : (connection as unknown as { environmentVariableName?: string }).environmentVariableName) === environmentName)) {
            setConnectionError(intl.formatMessage({ id: "settings.duplicateEnvironmentName" }));
            return;
        }

        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.addAiConnection({ label: connectionName, environmentVariableName: environmentName });
            setSettings((current) => current ? {
                ...current,
                connections: [...current.connections, connection],
                activeConnectionId: current.activeConnectionId ?? connection.id,
            } : current);
            setConnectionName("");
            setEnvironmentName("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function addManagedConnection() {
        if (!desktopSettings)
            return;

        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await desktopSettings.addManagedAiConnection({ label: managedConnectionName, apiKey });
            setSettings((current) => current ? {
                ...current,
                connections: [...current.connections, connection],
                activeConnectionId: current.activeConnectionId ?? connection.id,
            } : current);
            setManagedConnectionName("");
            setApiKey("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function setActiveConnection(connectionId: string) {
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.setActiveAiConnection(connectionId);
            setSettings((current) => current ? { ...current, activeConnectionId: connectionId } : current);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function renameManagedConnection() {
        if (!connectionPendingRename)
            return;

        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const source = connectionPendingRename.credentialSource;
            let connection: AiConnection;
            if (source.kind === "managed") {
                if (!desktopSettings)
                    return;

                connection = await desktopSettings.renameManagedAiConnection(connectionPendingRename.id, renamedConnectionLabel);
            } else {
                connection = await client.updateAiConnection(connectionPendingRename.id, { label: renamedConnectionLabel, environmentVariableName: source.environmentVariableName });
            }

            setSettings((current) => current ? { ...current, connections: current.connections.map((item) => item.id === connection.id ? connection : item) } : current);
            setConnectionPendingRename(undefined);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    function requestManagedConnectionRename(connection: AiConnection) {
        setConnectionPendingRename(connection);
        setRenamedConnectionLabel(connection.label);
    }


    async function removeConnection() {
        if (!connectionPendingRemoval)
            return;

        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.removeAiConnection(connectionPendingRemoval.id);
            setSettings((current) => current ? {
                ...current,
                connections: current.connections.filter((connection) => connection.id !== connectionPendingRemoval.id),
                activeConnectionId: current.activeConnectionId === connectionPendingRemoval.id ? undefined : current.activeConnectionId,
            } : current);
            setConnectionPendingRemoval(undefined);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function refreshModels() {
        try {
            setModels(await client.refreshAiModels());
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function savePublishingSettings(next: PublishingSettings) {
        setPublishingSettings(next);

        try {
            await client.setPublishingSettings(next);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.saveFailed" }) });
        }
    }


    return <main className="flex h-dvh flex-col overflow-hidden bg-surface text-ink md:flex-row">
        <SettingsNavigation section={section} setSection={setSection} back={back} status={status} />
        <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
                <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: settingsSections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
                {!settings ? null : section === "general" ? <GeneralSettingsSection general={general} save={saveGeneral} applyTheme={onThemeApplied} /> : section === "keyBindings" ? <KeyBindingSettings overrides={keyBindingOverrides} save={saveKeyBindingOverrides} /> : section === "ai" ? <AiSettingsSection settings={settings} preferences={preferences} models={models} connectionName={connectionName} environmentName={environmentName} managedConnectionName={managedConnectionName} apiKey={apiKey} connectionError={connectionError} setConnectionName={setConnectionName} setEnvironmentName={(value) => {
                    setEnvironmentName(value);
                    setConnectionError(undefined);
                }} setManagedConnectionName={setManagedConnectionName} setApiKey={setApiKey} onAddConnection={() => void addConnection()} onAddManagedConnection={desktopSettings ? () => void addManagedConnection() : undefined} onSetActiveConnection={(connectionId) => void setActiveConnection(connectionId)} onRequestConnectionRename={requestManagedConnectionRename} canRenameManagedConnection={Boolean(desktopSettings)} onRequestConnectionRemoval={setConnectionPendingRemoval} onRefreshModels={() => void refreshModels()} savePreferences={savePreferences} /> : section === "publishing" ? <PublishingSettingsSection publishing={publishingSettings} save={(next) => void savePublishingSettings(next)} general={general} saveGeneral={saveGeneral} /> : <DataBackupsSettingsSection client={client} backupPolicy={backupPolicy} save={saveBackupPolicy} />}
            </div>
            {connectionPendingRemoval && <ConnectionRemovalDialog connection={connectionPendingRemoval} close={() => setConnectionPendingRemoval(undefined)} remove={() => void removeConnection()} />}
            {connectionPendingRename && <ManagedConnectionRenameDialog label={renamedConnectionLabel} setLabel={setRenamedConnectionLabel} close={() => setConnectionPendingRename(undefined)} save={() => void renameManagedConnection()} />}
        </section>
    </main>;
}
