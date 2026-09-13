import { useEffect, useState } from "react";
import { getAiModelPreferenceId, AI_PROVIDER, defaultGeneralSettings, defaultPublishingSettings, type AiConnection, type AiProvider, type AppModelPreference, type ApplicationSettingsSnapshot, type AvailableAiModel, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type PublishingSettings } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application/client.js";
import { useIntl } from "react-intl";
import { useNotifications } from "../notifications/NotificationProvider.js";
import { getDesktopSettingsClient, getDesktopTelemetryClient } from "../application/desktop-client.js";
import { ConnectionRemovalDialog } from "./components/ConnectionRemovalDialog.js";
import { ManagedConnectionRenameDialog } from "./components/ManagedConnectionRenameDialog.js";
import { SettingsContent } from "./components/SettingsContent.js";
import { SettingsNavigation } from "./components/SettingsNavigation.js";
import { AboutSettingsSection } from "./components/AboutSettingsSection.js";
import { AiSettingsSection } from "./components/AiSettingsSection.js";
import { DataBackupsSettingsSection } from "./components/DataBackupsSettingsSection.js";
import { GeneralSettingsSection } from "./components/GeneralSettingsSection.js";
import { KeyBindingSettings } from "./components/KeyBindingSettings.js";
import { PublishingSettingsSection } from "./components/PublishingSettingsSection.js";
import type { SettingsSection } from "./settings-sections.js";


function getAvailableModels(value: unknown, connections: AiConnection[]): AvailableAiModel[] {
    const fallback = connections.find((connection) => connection.active !== false);
    return Array.isArray(value) ? value.flatMap((item): AvailableAiModel[] => {
        if (typeof item === "string" && fallback)
            return [{ id: getAiModelPreferenceId(fallback.id, item), model: item, connectionId: fallback.id, provider: fallback.provider }];

        return item && typeof item === "object" && typeof (item as AvailableAiModel).id === "string" && typeof (item as AvailableAiModel).model === "string"
            ? [item as AvailableAiModel]
            : [];
    }) : [];
}


export function ApplicationSettings(props: { client: EditorialWorkspaceClient; back: () => void; initialSection?: SettingsSection; onKeyBindingsUpdated?: (overrides: KeyBindingOverrides) => void; onThemeApplied?: (theme: GeneralSettings["theme"]) => void; focusUpdates?: boolean; onUpdatesFocused?: () => void }) {
    const { client, back, initialSection = "general", onKeyBindingsUpdated, onThemeApplied, focusUpdates = false, onUpdatesFocused } = props;
    const intl = useIntl();
    const { notify, notifyError } = useNotifications();
    const [section, setSection] = useState<SettingsSection>(initialSection);
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", skillOverrides: {} });
    const [appModel, setAppModel] = useState<AppModelPreference>();
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>({});
    const [publishingSettings, setPublishingSettings] = useState<PublishingSettings>(defaultPublishingSettings);
    const [models, setModels] = useState<AvailableAiModel[]>([]);
    const [connectionProvider, setConnectionProvider] = useState<AiProvider>(AI_PROVIDER.OPENAI);
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
    const telemetry = getDesktopTelemetryClient();

    useEffect(() => {
        void client.getApplicationSettings().then((loaded) => {
            setSettings(loaded);
            setGeneral(loaded.general);
            setPreferences(loaded.modelPreferences);
            setAppModel(loaded.appModel);
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
        if (!focusUpdates)
            return;

        setSection("about");
    }, [focusUpdates]);

    useEffect(() => {
        if (!focusUpdates || section !== "about" || !settings)
            return;

        requestAnimationFrame(() => {
            document.getElementById("settings-updates")?.focus();
            onUpdatesFocused?.();
        });
    }, [focusUpdates, onUpdatesFocused, section, settings]);

    useEffect(() => {
        if (section !== "ai" || !settings?.connections.some((connection) => connection.active !== false))
            return;

        void client.refreshAiModels().then((loaded) => setModels(getAvailableModels(loaded, settings.connections))).catch((error) => {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.modelsLoadFailed" }) });
        });
    }, [client, intl, notifyError, section, settings?.connections]);


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


    async function saveAppModel(next: AppModelPreference | null) {
        setAppModel(next ?? undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            await client.updateAppModel(next);
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
        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.addAiConnection({ provider: connectionProvider, label: connectionName, environmentVariableName: environmentName });
            setSettings((current) => current ? {
                ...current,
                connections: [...current.connections, connection],
            } : current);
            setConnectionName("");
            setEnvironmentName("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionAddFailed" }) });
        }
    }


    async function addManagedConnection() {
        if (!desktopSettings)
            return;

        setConnectionError(undefined);
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await desktopSettings.addManagedAiConnection({ provider: connectionProvider, label: managedConnectionName, apiKey });
            setSettings((current) => current ? {
                ...current,
                connections: [...current.connections, connection],
            } : current);
            setManagedConnectionName("");
            setApiKey("");
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionAddFailed" }) });
        }
    }


    async function setConnectionActive(connectionId: string, active: boolean) {
        setStatus(intl.formatMessage({ id: "settings.saving" }));
        try {
            const connection = await client.setAiConnectionActive(connectionId, active);
            setSettings((current) => current ? { ...current, connections: current.connections.map((item) => item.id === connection.id ? connection : item) } : current);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionUpdateFailed" }) });
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
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionUpdateFailed" }) });
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
            } : current);
            setConnectionPendingRemoval(undefined);
            setModels([]);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            setStatus(intl.formatMessage({ id: "settings.saveFailed" }));
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.connectionRemoveFailed" }) });
        }
    }


    async function refreshModels() {
        try {
            setModels(getAvailableModels(await client.refreshAiModels(), settings?.connections ?? []));
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.modelsLoadFailed" }) });
        }
    }


    async function savePublishingSettings(next: PublishingSettings) {
        setPublishingSettings(next);

        try {
            await client.setPublishingSettings(next);
            setStatus(intl.formatMessage({ id: "settings.saved" }));
        } catch (error) {
            notifyError(error, { fallbackMessage: intl.formatMessage({ id: "settings.publishingSaveFailed" }) });
        }
    }


    let sectionContent = <DataBackupsSettingsSection client={client} backupPolicy={backupPolicy} save={saveBackupPolicy} />;
    if (settings && section === "general")
        sectionContent = <GeneralSettingsSection general={general} save={saveGeneral} applyTheme={onThemeApplied} telemetry={telemetry} />;
    else if (settings && section === "keyBindings")
        sectionContent = <KeyBindingSettings general={general} saveGeneral={saveGeneral} overrides={keyBindingOverrides} save={saveKeyBindingOverrides} />;
    else if (settings && section === "ai")
        sectionContent = <AiSettingsSection settings={settings} preferences={preferences} appModel={appModel} models={models} connectionProvider={connectionProvider} connectionName={connectionName} environmentName={environmentName} managedConnectionName={managedConnectionName} apiKey={apiKey} connectionError={connectionError} setConnectionProvider={setConnectionProvider} setConnectionName={setConnectionName} setEnvironmentName={(value) => {
            setEnvironmentName(value);
            setConnectionError(undefined);
        }} setManagedConnectionName={setManagedConnectionName} setApiKey={setApiKey} onAddConnection={() => void addConnection()} onAddManagedConnection={desktopSettings ? () => void addManagedConnection() : undefined} onSetConnectionActive={(connectionId, active) => void setConnectionActive(connectionId, active)} onRequestConnectionRename={requestManagedConnectionRename} canRenameManagedConnection={Boolean(desktopSettings)} onRequestConnectionRemoval={setConnectionPendingRemoval} onRefreshModels={() => void refreshModels()} savePreferences={savePreferences} saveAppModel={saveAppModel} />;
    else if (settings && section === "publishing")
        sectionContent = <PublishingSettingsSection publishing={publishingSettings} save={savePublishingSettings} general={general} saveGeneral={saveGeneral} />;
    else if (settings && section === "about")
        sectionContent = <AboutSettingsSection />;


    return <main className="flex h-dvh flex-col overflow-hidden bg-surface text-ink md:flex-row">
        <SettingsNavigation section={section} setSection={setSection} back={back} status={status} />
        <SettingsContent section={section} settings={settings}>{sectionContent}</SettingsContent>
        {connectionPendingRemoval && <ConnectionRemovalDialog connection={connectionPendingRemoval} close={() => setConnectionPendingRemoval(undefined)} remove={() => void removeConnection()} />}
        {connectionPendingRename && <ManagedConnectionRenameDialog label={renamedConnectionLabel} setLabel={setRenamedConnectionLabel} close={() => setConnectionPendingRename(undefined)} save={() => void renameManagedConnection()} />}
    </main>;
}
