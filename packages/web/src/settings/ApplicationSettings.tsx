import { cloneElement, isValidElement, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { defaultPublishLimitProfileId, defaultGeneralSettings, findKeyBindingConflict, formatKeyBinding, keyBindingCommands, keyBindingsEqual, normalizeKeyBinding, resolveKeyBindings, publishLimitProfiles, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type KeyBindingCommandId, type KeyBindingOverrides, type ModelPreferences, type PublishLimitProfileId } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Banner, Button, Field, Select } from "../ui/primitives.js";
import { catalogByLocale, installedLocaleCatalogs } from "../i18n/catalogs.js";
import { formatDateTime, formatTimeZoneLabel, systemTimeZone, timeZoneOptions } from "../i18n/formatting.js";
import { useIntl } from "react-intl";
import { publishingProfileMessageId } from "../i18n/publishing.js";
import { useNotifications } from "../notifications/NotificationProvider.js";

type Section = "general" | "keyBindings" | "ai" | "publishing" | "backups";

const sections: { id: Section; label: "settings.general" | "settings.keyBindings" | "settings.ai" | "settings.publishingProfiles" | "settings.dataBackups" }[] = [
    { id: "general", label: "settings.general" },
    { id: "keyBindings", label: "settings.keyBindings" },
    { id: "ai", label: "settings.ai" },
    { id: "publishing", label: "settings.publishingProfiles" },
    { id: "backups", label: "settings.dataBackups" },
];

function KeyBindingSettings({ overrides, save }: { overrides: KeyBindingOverrides; save: (next: KeyBindingOverrides) => Promise<void> }) {
    const intl = useIntl();
    const [recording, setRecording] = useState<KeyBindingCommandId>();
    const [error, setError] = useState<{ commandId: KeyBindingCommandId; assignedCommand: string }>();
    const platform = typeof navigator === "undefined" ? "" : navigator.platform;
    const effective = resolveKeyBindings(overrides);

    async function record(commandId: KeyBindingCommandId, event: KeyboardEvent<HTMLButtonElement>) {
        if (recording !== commandId)
            return;

        event.preventDefault();
        if (event.key === "Escape" && commandId !== "stop_editorial_request") {
            setRecording(undefined);
            return;
        }

        const binding = normalizeKeyBinding({ primary: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey, key: event.key });
        if (!binding)
            return;

        const next = { ...overrides, [commandId]: binding };
        const conflict = findKeyBindingConflict(resolveKeyBindings(next));
        if (conflict) {
            const other = conflict.find((id) => id !== commandId) ?? commandId;
            const command = keyBindingCommands.find((item) => item.id === other)!;
            setError({
                commandId,
                assignedCommand: intl.formatMessage({ id: command.labelMessageId }),
            });

            return;
        }

        setError(undefined);
        setRecording(undefined);
        await save(next);
    }

    return <>
        <p className="mt-3 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.keyBindingsIntro" })}</p>
        {(["general", "workspace", "assistant"] as const).map((category) => <section key={category} className="border-b border-border py-5 last:border-b-0">
            <h2 className="text-sm font-semibold">{intl.formatMessage({ id: `settings.keyBindingCategory.${category}` })}</h2>
            <div className="mt-3 grid gap-3">{keyBindingCommands.filter((command) => command.category === category).map((command) => {
                const override = overrides[command.id];
                const isOverridden = Object.prototype.hasOwnProperty.call(overrides, command.id)
                    && (override === null || (override !== undefined && !keyBindingsEqual(override, command.defaultBinding)));
                const listening = recording === command.id;
                return <div key={command.id} className="rounded-control border border-border p-3">
                    <p className="text-sm font-medium">{intl.formatMessage({ id: command.labelMessageId })}</p>
                    <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: command.hintMessageId })}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant={listening ? "secondary" : "quiet"} aria-label={intl.formatMessage({ id: "settings.recordKeyBinding" }, { command: intl.formatMessage({ id: command.labelMessageId }) })} aria-describedby={error?.commandId === command.id ? `key-binding-error-${command.id}` : undefined} onBlur={() => {
                            if (recording === command.id) {
                                setRecording(undefined);
                                setError((current) => current?.commandId === command.id ? undefined : current);
                            }
                        }} onClick={() => {
                            setError(undefined);
                            setRecording(command.id);
                        }} onKeyDown={(event) => void record(command.id, event)}>{listening ? intl.formatMessage({ id: "settings.recordingKeyBinding" }) : formatKeyBinding(effective[command.id], platform)}</Button>
                        <Button variant="quiet" onClick={() => {
                            setError(undefined);
                            void save({ ...overrides, [command.id]: null });
                        }}>{intl.formatMessage({ id: "settings.clearKeyBinding" })}</Button>
                        {isOverridden && <Button variant="quiet" onClick={() => {
                            const next = { ...overrides };
                            delete next[command.id];
                            setError(undefined);
                            void save(next);
                        }}>{intl.formatMessage({ id: "settings.resetKeyBinding" })}</Button>}
                    </div>
                    {error?.commandId === command.id && <div id={`key-binding-error-${command.id}`} className="mt-3" role="alert">
                        <Banner tone="warning" role="alert"><span>{intl.formatMessage({ id: "settings.keyBindingConflictTitle" })} <strong>{error.assignedCommand}</strong>. {intl.formatMessage({ id: "settings.keyBindingConflict" })}</span></Banner>
                    </div>}
                </div>;
            })}</div>
        </section>)}
    </>;
}

const operations = [
    ["thesis_to_narrative", "operations.thesisToNarrative"],
    ["flow_revision", "operations.flowRevision"],
    ["fact_check", "operations.factCheck"],
    ["style_review", "operations.styleReview"],
    ["translation", "operations.translation"],
] as const;

function SettingRow({ label, hint, children, status, action }: { label: string; hint: string; children: ReactNode; status?: ReactNode; action?: ReactNode }) {
    const hintId = useId();

    return <section className="border-b border-border py-5 last:border-b-0">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p id={hintId} className="mt-1 text-sm leading-5 text-muted">{hint}</p>
        <div className="mt-3 max-w-md">{isValidElement(children) ? cloneElement(children, { "aria-describedby": hintId }) : children}</div>
        {action && <div className="mt-3">{action}</div>}
        {status && <p className="mt-2 text-xs text-muted" role="status">{status}</p>}
    </section>;
}

function Control({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
    const hintId = useId();

    return <div>
        <p className="text-sm font-medium">{label}</p>
        <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>
        <div className="mt-2" aria-describedby={hintId}>{children}</div>
    </div>;
}

function formatExample(general: GeneralSettings): string {
    return formatDateTime(new Date(), general.interfaceLocale, general.dateFormat, general.timeFormat, general.timeZone);
}

export function ApplicationSettings({ client, back, onKeyBindingsUpdated }: { client: EditorialWorkspaceClient; back: () => void; onKeyBindingsUpdated?: (overrides: KeyBindingOverrides) => void }) {
    const intl = useIntl();
    const { notify, notifyError } = useNotifications();
    const [section, setSection] = useState<Section>("general");
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", operationOverrides: {} });
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [keyBindingOverrides, setKeyBindingOverrides] = useState<KeyBindingOverrides>({});
    const [publishingProfileId, setPublishingProfileId] = useState<PublishLimitProfileId>(defaultPublishLimitProfileId);
    const [models, setModels] = useState<string[]>([]);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
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
        try {
            await client.addOpenAiConnection({ label: connectionName, environmentVariableName: environmentName });
        } catch (error) {
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
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-supporting md:flex md:flex-col" aria-label={intl.formatMessage({ id: "settings.navigation" })}>
            <header className="flex min-h-18 items-center border-b border-border px-3"><Button variant="quiet" onClick={back}>{intl.formatMessage({ id: "settings.backToWorkspace" })}</Button></header>
            <nav className="p-2">{sections.map((item) => <button key={item.id} className={`min-h-10 w-full rounded-control px-3 text-left text-sm ${section === item.id ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface"}`} onClick={() => setSection(item.id)}>{intl.formatMessage({ id: item.label })}</button>)}</nav>
            <footer className="mt-auto border-t border-border px-4 py-3 text-micro text-muted" role="status"><span aria-hidden="true">&#9679;</span> {status}</footer>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="mx-auto w-full max-w-3xl px-5 py-8">
                <h1 className="text-2xl font-semibold">{intl.formatMessage({ id: sections.find((item) => item.id === section)?.label ?? "settings.general" })}</h1>
                {!settings ? null : section === "general" ? <>
                    <SettingRow label={intl.formatMessage({ id: "settings.preferredAppearance" })} hint={intl.formatMessage({ id: "settings.appearanceHint" })}><Select value={general.theme} onChange={(event) => void saveGeneral({ ...general, theme: event.target.value as GeneralSettings["theme"] })}><option value="system">{intl.formatMessage({ id: "settings.system" })}</option><option value="light">{intl.formatMessage({ id: "settings.light" })}</option><option value="dark">{intl.formatMessage({ id: "settings.dark" })}</option></Select></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.interfaceLanguage" })} hint={intl.formatMessage({ id: "settings.interfaceLanguageHint" })}><Select value={catalogByLocale.has(general.interfaceLocale) ? general.interfaceLocale : "en"} disabled={installedLocaleCatalogs.length === 1} onChange={(event) => void saveGeneral({ ...general, interfaceLocale: event.target.value as GeneralSettings["interfaceLocale"] })}>{installedLocaleCatalogs.map((catalog) => <option key={catalog.code} value={catalog.code}>{intl.formatMessage({ id: catalog.nameMessageId })}</option>)}</Select></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.dateFormat" })} hint={intl.formatMessage({ id: "settings.dateFormatHint" })}><Select value={general.dateFormat} onChange={(event) => void saveGeneral({ ...general, dateFormat: event.target.value as GeneralSettings["dateFormat"] })}><option value="system">{intl.formatMessage({ id: "settings.system" })}</option><option value="day-first">{intl.formatMessage({ id: "settings.dayFirst" })}</option><option value="month-first">{intl.formatMessage({ id: "settings.monthFirst" })}</option><option value="iso">{intl.formatMessage({ id: "settings.iso" })}</option></Select></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.timeFormat" })} hint={intl.formatMessage({ id: "settings.timeFormatHint" })} status={intl.formatMessage({ id: "settings.example" }, { value: formatExample(general) })}><Select value={general.timeFormat} onChange={(event) => void saveGeneral({ ...general, timeFormat: event.target.value as GeneralSettings["timeFormat"] })}><option value="system">{intl.formatMessage({ id: "settings.system" })}</option><option value="12-hour">{intl.formatMessage({ id: "settings.twelveHour" })}</option><option value="24-hour">{intl.formatMessage({ id: "settings.twentyFourHour" })}</option></Select></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.timeZone" })} hint={intl.formatMessage({ id: "settings.timeZoneHint" })} action={<Button variant="quiet" disabled={general.timeZone === "system"} onClick={() => void saveGeneral({ ...general, timeZone: "system" })}>{intl.formatMessage({ id: "settings.resetTimeZone" })}</Button>}><Select value={general.timeZone} onChange={(event) => void saveGeneral({ ...general, timeZone: event.target.value })}><option value="system">{intl.formatMessage({ id: "settings.systemTimeZone" }, { timeZone: systemTimeZone() ? formatTimeZoneLabel(systemTimeZone()!) : intl.formatMessage({ id: "settings.localTimeZone" }) })}</option>{timeZoneOptions(general.timeZone).map((timeZone) => <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>)}</Select></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.defaultArticleLanguage" })} hint={intl.formatMessage({ id: "settings.defaultArticleLanguageHint" })}><Select value={general.defaultArticleLanguage} onChange={(event) => void saveGeneral({ ...general, defaultArticleLanguage: event.target.value })}>{[["en", "languages.english"], ["es", "languages.spanish"], ["pt", "languages.portuguese"], ["ru", "languages.russian"], ["fr", "languages.french"], ["de", "languages.german"], ["it", "languages.italian"]].map(([value, label]) => <option key={value} value={value}>{intl.formatMessage({ id: label as "languages.english" | "languages.spanish" | "languages.portuguese" | "languages.russian" | "languages.french" | "languages.german" | "languages.italian" })}</option>)}</Select></SettingRow>
                </> : section === "keyBindings" ? <KeyBindingSettings overrides={keyBindingOverrides} save={saveKeyBindingOverrides} /> : section === "ai" ? <>
                    <SettingRow label={intl.formatMessage({ id: "settings.addConnection" })} hint={intl.formatMessage({ id: "settings.connectionHint" })}><div className="grid gap-4"><Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}><Field value={connectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => setConnectionName(event.target.value)} /></Control><Control label={intl.formatMessage({ id: "settings.environmentName" })} hint={intl.formatMessage({ id: "settings.environmentNameHint" })}><Field value={environmentName} placeholder={intl.formatMessage({ id: "settings.environmentNamePlaceholder" })} onChange={(event) => setEnvironmentName(event.target.value)} /></Control><Button className="w-fit" variant="secondary" onClick={() => void addConnection()}>{intl.formatMessage({ id: "settings.addConnectionButton" })}</Button></div></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.defaultModel" })} hint={intl.formatMessage({ id: "settings.defaultModelHint" })}><Control label={intl.formatMessage({ id: "settings.model" })} hint={intl.formatMessage({ id: "settings.modelHint" })}><Select value={preferences.defaultModel} disabled={models.length === 0} onChange={(event) => void savePreferences({ ...preferences, defaultModel: event.target.value })}><option value="">{models.length === 0 ? intl.formatMessage({ id: "settings.noModels" }) : intl.formatMessage({ id: "settings.chooseModel" })}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control><Button className="mt-3 w-fit" variant="secondary" onClick={() => void refreshModels()}>{intl.formatMessage({ id: "settings.refreshModels" })}</Button></SettingRow>
                    <SettingRow label={intl.formatMessage({ id: "settings.specificModels" })} hint={intl.formatMessage({ id: "settings.specificModelsHint" })}><div className="grid gap-4">{operations.map(([operation, label]) => <Control key={operation} label={intl.formatMessage({ id: label as "operations.thesisToNarrative" | "operations.flowRevision" | "operations.factCheck" | "operations.styleReview" | "operations.translation" })} hint={intl.formatMessage({ id: "settings.specificModelHint" })}><Select value={preferences.operationOverrides[operation] ?? ""} onChange={(event) => void savePreferences({ ...preferences, operationOverrides: { ...preferences.operationOverrides, [operation]: event.target.value } })}><option value="">{intl.formatMessage({ id: "settings.useDefaultModel" })}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control>)}</div></SettingRow>
                </> : section === "publishing" ? <SettingRow label={intl.formatMessage({ id: "settings.publishingProfile" })} hint={intl.formatMessage({ id: "settings.publishingProfileHint" })}><Select value={publishingProfileId} onChange={(event) => {
                    const profileId = event.target.value as PublishLimitProfileId;
                    setPublishingProfileId(profileId);
                    void savePublishingProfile(profileId);
                }}>{publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{intl.formatMessage({ id: "settings.profileCharacters" }, { label: intl.formatMessage({ id: publishingProfileMessageId(profile.id) }), count: intl.formatNumber(profile.characterLimit) })}</option>)}</Select><p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "settings.publishingProfileNote" })}</p></SettingRow> : <><SettingRow label={intl.formatMessage({ id: "settings.activeDataLocation" })} hint={intl.formatMessage({ id: "settings.activeDataHint" })}><Field value={intl.formatMessage({ id: "settings.localDataDirectory" })} readOnly /></SettingRow><SettingRow label={intl.formatMessage({ id: "settings.backupDestination" })} hint={intl.formatMessage({ id: "settings.backupDestinationHint" })}><Field value={backupPolicy.destinationPath ?? ""} placeholder={intl.formatMessage({ id: "settings.backupPlaceholder" })} onChange={(event) => setBackupPolicy({ ...backupPolicy, destinationPath: event.target.value })} onBlur={() => void saveBackupPolicy(backupPolicy)} /></SettingRow><SettingRow label={intl.formatMessage({ id: "settings.automaticBackups" })} hint={intl.formatMessage({ id: "settings.automaticBackupsHint" })}><Select value={backupPolicy.schedule} onChange={(event) => void saveBackupPolicy({ ...backupPolicy, schedule: event.target.value as BackupPolicy["schedule"] })}><option value="off">{intl.formatMessage({ id: "settings.off" })}</option><option value="daily">{intl.formatMessage({ id: "settings.daily" })}</option></Select></SettingRow><SettingRow label={intl.formatMessage({ id: "settings.retention" })} hint={intl.formatMessage({ id: "settings.retentionHint" })}><Select value={backupPolicy.retention.mode === "unlimited" ? "unlimited" : String(backupPolicy.retention.count)} onChange={(event) => void saveBackupPolicy({ ...backupPolicy, retention: event.target.value === "unlimited" ? { mode: "unlimited" } : { mode: "count", count: Number(event.target.value) } })}><option value="7">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 7 })}</option><option value="30">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 30 })}</option><option value="90">{intl.formatMessage({ id: "settings.keepBackups" }, { count: 90 })}</option><option value="unlimited">{intl.formatMessage({ id: "settings.keepAllBackups" })}</option></Select></SettingRow></>}
            </div>
        </section>
    </main>;
}
