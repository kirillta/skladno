import { useEffect, useState } from "react";
import { defaultGeneralSettings, defaultPublishLimitProfileId, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type OpenAiConnection, type PublishLimitProfileId } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { useIntl } from "react-intl";
import { useNotifications } from "../notifications/NotificationProvider.js";
import { AiSettingsSection } from "./components/AiSettingsSection.js";
import { ConnectionRemovalDialog } from "./components/ConnectionRemovalDialog.js";
import { DataBackupsSettingsSection } from "./components/DataBackupsSettingsSection.js";
import { GeneralSettingsSection } from "./components/GeneralSettingsSection.js";
import { KeyBindingSettings } from "./components/KeyBindingSettings.js";
import { PublishingSettingsSection } from "./components/PublishingSettingsSection.js";
import { SettingsNavigation } from "./components/SettingsNavigation.js";
import { settingsSections, type SettingsSection } from "./settings-sections.js";


export function ApplicationSettings({ client, back, onKeyBindingsUpdated }: { client: EditorialWorkspaceClient; back: () => void; onKeyBindingsUpdated?: (overrides: KeyBindingOverrides) => void }) {
    const intl = useIntl();
    const { notify, notifyError } = useNotifications();
    const [section, setSection] = useState<SettingsSection>("general");
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", skillOverrides: {} });
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>({});
    const [publishingProfileId, setPublishingProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);
    const [models, setModels] = useState<string[]>([]);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
    const [connectionError, setConnectionError] = useState<string>();
    const [connectionPendingRemoval, setConnectionPendingRemoval] = useState<OpenAiConnection>();
    const [status, setStatus] = useState(() => intl.formatMessage({ id: "settings.loading" }));

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
        void client.getPublishLimitProfile().then(setPublishingProfileId).catch((error) => notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.loadingFailed" }) }));
    }, [client, intl, notifyError]);

    useEffect(() => {
        if (section !== "ai" || !settings?.activeConnectionId)
            return;

        void client.refreshOpenAiModels().then(setModels).catch((error) => {
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
        if (settings?.connections.some((connection) => connection.environmentVariableName === environmentName)) {
            setConnectionError(intl.formatMessage({ id: "settings.duplicateEnvironmentName" }));
            return;
        }

        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.addOpenAiConnection({ label: connectionName, environmentVariableName: environmentName });
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


    async function setActiveConnection(connectionId: string) {
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.setActiveOpenAiConnection(connectionId);
            setSettings((current) => current ? { ...current, activeConnectionId: connectionId } : current);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function removeConnection() {
        if (!connectionPendingRemoval)
            return;

        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.removeOpenAiConnection(connectionPendingRemoval.id);
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
            setModels(await client.refreshOpenAiModels());
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
        }
    }


    async function savePublishingProfile(profileId: PublishLimitProfileId) {
        setPublishingProfileId(profileId);

        try {
            await client.setPublishLimitProfile(profileId);
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.saveFailed" }) });
        }
    }


    return <main className="flex h-dvh overflow-hidden bg-surface text-ink">
        <SettingsNavigation section={section} setSection={setSection} back={back} status={status} />
        <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="mx-auto w-full max-w-3xl px-5 py-8">
                <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: settingsSections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
                {!settings ? null : section === "general" ? <GeneralSettingsSection general={general} save={saveGeneral} /> : section === "keyBindings" ? <KeyBindingSettings overrides={keyBindingOverrides} save={saveKeyBindingOverrides} /> : section === "ai" ? <AiSettingsSection settings={settings} preferences={preferences} models={models} connectionName={connectionName} environmentName={environmentName} connectionError={connectionError} setConnectionName={setConnectionName} setEnvironmentName={(value) => {
                    setEnvironmentName(value);
                    setConnectionError(undefined);
                }} onAddConnection={() => void addConnection()} onSetActiveConnection={(connectionId) => void setActiveConnection(connectionId)} onRequestConnectionRemoval={setConnectionPendingRemoval} onRefreshModels={() => void refreshModels()} savePreferences={savePreferences} /> : section === "publishing" ? <PublishingSettingsSection profileId={publishingProfileId} save={(profileId) => void savePublishingProfile(profileId)} general={general} saveGeneral={saveGeneral} /> : <DataBackupsSettingsSection backupPolicy={backupPolicy} setBackupPolicy={setBackupPolicy} save={saveBackupPolicy} />}
            </div>
            {connectionPendingRemoval && <ConnectionRemovalDialog connection={connectionPendingRemoval} close={() => setConnectionPendingRemoval(undefined)} remove={() => void removeConnection()} />}
        </section>
    </main>;
}
