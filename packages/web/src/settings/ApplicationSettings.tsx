import { useEffect, useState } from "react";
import { defaultGeneralSettings, defaultPublishingSettings, type AppModelPreference, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type KeyBindingOverrides, type ModelPreferences, type PublishingSettings } from "@skladno/shared";
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
import { useAiSettingsController } from "./use-ai-settings-controller.js";
import { settingsFocusAreas, useFocusAreaNavigation } from "../ui/focus-area-navigation.js";


export function ApplicationSettings(props: { client: EditorialWorkspaceClient; back: () => void; initialSection?: SettingsSection; onKeyBindingsUpdated?: (overrides: KeyBindingOverrides) => void; onThemeApplied?: (theme: GeneralSettings["theme"]) => void; focusUpdates?: boolean; onUpdatesFocused?: () => void; openQuickStart?: () => void }) {
    const { client, back, initialSection = "general", onKeyBindingsUpdated, onThemeApplied, focusUpdates = false, onUpdatesFocused, openQuickStart } = props;
    const intl = useIntl();
    const focusAreas = useFocusAreaNavigation(settingsFocusAreas);
    const { notify, notifyError } = useNotifications();
    const [section, setSection] = useState<SettingsSection>(initialSection);
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", skillOverrides: {} });
    const [appModel, setAppModel] = useState<AppModelPreference>();
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>({});
    const [publishingSettings, setPublishingSettings] = useState<PublishingSettings>(defaultPublishingSettings);
    const [status, setStatus] = useState(() => intl.formatMessage({ id: "settings.loading" }));
    const desktopSettings = getDesktopSettingsClient();
    const telemetry = getDesktopTelemetryClient();
    const ai = useAiSettingsController({ client, intl, settings, desktopSettings, setSettings, setStatus, aiSettingsOpen: section === "ai" });

    useEffect(() => setSection(initialSection), [initialSection]);

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
        sectionContent = <AiSettingsSection
            settings={settings}
            preferences={preferences}
            appModel={appModel}
            models={ai.models}
            connectionProvider={ai.connectionProvider}
            connectionName={ai.connectionName}
            environmentName={ai.environmentName}
            managedConnectionName={ai.managedConnectionName}
            apiKey={ai.apiKey}
            connectionError={ai.connectionError}
            setConnectionProvider={ai.setConnectionProvider}
            setConnectionName={ai.setConnectionName}
            setEnvironmentName={ai.setEnvironmentName}
            setManagedConnectionName={ai.setManagedConnectionName}
            setApiKey={ai.setApiKey}
            onAddConnection={() => void ai.addConnection()}
            onAddManagedConnection={desktopSettings ? () => void ai.addManagedConnection() : undefined}
            onSetConnectionActive={(connectionId, active) => void ai.setConnectionActive(connectionId, active)}
            onRequestConnectionRename={ai.requestManagedConnectionRename}
            canRenameManagedConnection={Boolean(desktopSettings)}
            onRequestConnectionRemoval={ai.setConnectionPendingRemoval}
            onRefreshModels={() => void ai.refreshModels()}
            savePreferences={savePreferences}
            saveAppModel={saveAppModel} />;
    else if (settings && section === "publishing")
        sectionContent = <PublishingSettingsSection publishing={publishingSettings} save={savePublishingSettings} general={general} saveGeneral={saveGeneral} />;
    else if (settings && section === "about")
        sectionContent = <AboutSettingsSection openQuickStart={openQuickStart} />;


    return <main ref={focusAreas.ref} onFocusCapture={focusAreas.onFocusCapture} onKeyDownCapture={focusAreas.onKeyDownCapture} className="flex h-screen flex-col overflow-hidden bg-surface text-ink md:flex-row">
        <SettingsNavigation section={section} setSection={setSection} back={back} status={status} />
        <SettingsContent section={section} settings={settings}>{sectionContent}</SettingsContent>
        {ai.connectionPendingRemoval && <ConnectionRemovalDialog connection={ai.connectionPendingRemoval} close={() => ai.setConnectionPendingRemoval(undefined)} remove={() => void ai.removeConnection()} />}
        {ai.connectionPendingRename && <ManagedConnectionRenameDialog label={ai.renamedConnectionLabel} setLabel={ai.setRenamedConnectionLabel} close={() => ai.setConnectionPendingRename(undefined)} save={() => void ai.renameManagedConnection()} />}
    </main>;
}
