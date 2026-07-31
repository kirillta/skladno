import { useEffect, useId, useState, type ReactNode } from "react";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings, type ModelPreferences } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Button, Field, Select, Status } from "../ui/primitives.js";

type Section = "general" | "ai" | "publishing" | "backups";

const sections: { id: Section; label: string }[] = [
    { id: "general", label: "General" },
    { id: "ai", label: "AI" },
    { id: "publishing", label: "Publishing profiles" },
    { id: "backups", label: "Data & backups" },
];

const operations = [
    ["thesis_to_narrative", "Thesis to narrative"],
    ["flow_revision", "Flow revision"],
    ["fact_check", "Fact check"],
    ["style_review", "Style review"],
    ["translation", "Translation"],
] as const;

function SettingRow({ label, hint, children, status }: { label: string; hint: string; children: ReactNode; status?: ReactNode }) {
    const hintId = useId();

    return <section className="border-b border-border py-5 last:border-b-0">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p id={hintId} className="mt-1 text-sm leading-5 text-muted">{hint}</p>
        <div className="mt-3 max-w-md" aria-describedby={hintId}>{children}</div>
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
    const value = new Date("2026-07-31T15:45:00Z");
    const dateOptions = general.dateFormat === "day-first"
        ? { day: "2-digit", month: "2-digit", year: "numeric" } as const
        : general.dateFormat === "month-first"
            ? { month: "2-digit", day: "2-digit", year: "numeric" } as const
            : general.dateFormat === "iso"
                ? { year: "numeric", month: "2-digit", day: "2-digit" } as const
                : { dateStyle: "medium" } as const;
    const timeOptions = { hour: "numeric", minute: "2-digit", hour12: general.timeFormat === "12-hour" ? true : general.timeFormat === "24-hour" ? false : undefined } as const;

    return `${new Intl.DateTimeFormat("en", dateOptions).format(value)}, ${new Intl.DateTimeFormat("en", timeOptions).format(value)}`;
}

export function ApplicationSettings({ client, back }: { client: EditorialWorkspaceClient; back: () => void }) {
    const [section, setSection] = useState<Section>("general");
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "", operationOverrides: {} });
    const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [models, setModels] = useState<string[]>([]);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
    const [status, setStatus] = useState("Loading settings…");

    useEffect(() => {
        void client.getApplicationSettings().then((loaded) => {
            setSettings(loaded);
            setGeneral(loaded.general);
            setPreferences(loaded.modelPreferences);
            setBackupPolicy(loaded.backupPolicy);
            setStatus("Saved");
        }).catch(() => setStatus("Couldn’t load settings."));
    }, [client]);

    async function saveGeneral(next: GeneralSettings) {
        setGeneral(next);
        setStatus("Saving…");
        try {
            await client.updateGeneralSettings(next);
            setStatus("Saved");
        } catch {
            setStatus("Couldn’t save your changes.");
        }
    }

    async function savePreferences(next: ModelPreferences) {
        setPreferences(next);
        setStatus("Saving…");
        try {
            await client.updateModelPreferences(next);
            setStatus("Saved");
        } catch {
            setStatus("Couldn’t save model preferences.");
        }
    }

    async function saveBackupPolicy(next: BackupPolicy) {
        setBackupPolicy(next);
        setStatus("Saving…");
        try {
            await client.updateBackupPolicy(next);
            setStatus("Saved");
        } catch {
            setStatus("Couldn’t save backup settings.");
        }
    }

    return <main className="flex h-dvh overflow-hidden bg-surface text-ink">
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-supporting md:flex md:flex-col" aria-label="Settings Navigation">
            <header className="flex min-h-18 items-center border-b border-border px-3"><Button variant="quiet" onClick={back}>Back to workspace</Button></header>
            <nav className="p-2">{sections.map((item) => <button key={item.id} className={`min-h-10 w-full rounded-control px-3 text-left text-sm ${section === item.id ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface"}`} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
            <footer className="mt-auto border-t border-border px-4 py-3 text-micro text-muted" role="status"><span aria-hidden="true">&#9679;</span> {status}</footer>
        </aside>
        <section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="mx-auto w-full max-w-3xl px-5 py-8">
                <h1 className="text-2xl font-semibold">{sections.find((item) => item.id === section)?.label}</h1>
                {!settings ? null : section === "general" ? <>
                    <SettingRow label="Preferred appearance" hint="Choose the appearance you want Skladno to use. Your preference will be remembered, but visual themes will be enabled in a later update."><Select value={general.theme} onChange={(event) => void saveGeneral({ ...general, theme: event.target.value as GeneralSettings["theme"] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></SettingRow>
                    <SettingRow label="Interface language" hint="Changes the language of Skladno’s controls and messages. English is the only complete interface language for now."><Select value="en" disabled><option>English</option></Select></SettingRow>
                    <SettingRow label="Date format" hint="Changes how dates are shown in Skladno. It does not change saved dates or revision history."><Select value={general.dateFormat} onChange={(event) => void saveGeneral({ ...general, dateFormat: event.target.value as GeneralSettings["dateFormat"] })}><option value="system">System</option><option value="day-first">Day first</option><option value="month-first">Month first</option><option value="iso">ISO</option></Select></SettingRow>
                    <SettingRow label="Time format" hint="Changes how times are shown in Skladno. It does not change saved dates or revision history." status={`Example: ${formatExample(general)}`}><Select value={general.timeFormat} onChange={(event) => void saveGeneral({ ...general, timeFormat: event.target.value as GeneralSettings["timeFormat"] })}><option value="system">System</option><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></Select></SettingRow>
                    <SettingRow label="Default Article language" hint="Used for new Articles when you do not choose a language yourself. Existing Articles are not changed."><Select value={general.defaultArticleLanguage} onChange={(event) => void saveGeneral({ ...general, defaultArticleLanguage: event.target.value })}>{[["en", "English"], ["es", "Spanish"], ["pt", "Portuguese"], ["ru", "Russian"], ["fr", "French"], ["de", "German"], ["it", "Italian"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></SettingRow>
                </> : section === "ai" ? <>
                    <SettingRow label="Add an OpenAI connection" hint="Your OpenAI key stays private on this computer. Skladno stores only the name of where it is kept."><div className="grid gap-4"><Control label="Connection name" hint="Use a familiar name, such as Personal OpenAI."><Field value={connectionName} placeholder="For example, Personal OpenAI" onChange={(event) => setConnectionName(event.target.value)} /></Control><Control label="Environment-variable name" hint="The name used when your local service starts. Your key is never displayed."><Field value={environmentName} placeholder="For example, OPENAI_API_KEY" onChange={(event) => setEnvironmentName(event.target.value)} /></Control><Button className="w-fit" variant="secondary" onClick={() => void client.addOpenAiConnection({ label: connectionName, environmentVariableName: environmentName })}>Add connection</Button></div></SettingRow>
                    <SettingRow label="Default model" hint="Used for AI work unless a task has its own model choice."><Control label="Model" hint="Check a connection, then refresh its available models before choosing one."><Select value={preferences.defaultModel} disabled={models.length === 0} onChange={(event) => void savePreferences({ ...preferences, defaultModel: event.target.value })}><option value="">{models.length === 0 ? "No available models yet" : "Choose a model"}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control><Button className="mt-3 w-fit" variant="secondary" onClick={() => void client.refreshOpenAiModels().then(setModels)}>Refresh available models</Button></SettingRow>
                    <SettingRow label="Models for specific tasks" hint="Choose a model for a task, or use the default model. This affects future AI requests only."><div className="grid gap-4">{operations.map(([operation, label]) => <Control key={operation} label={label} hint="Leave this on Use default model unless this task needs a different model."><Select value={preferences.operationOverrides[operation] ?? ""} onChange={(event) => void savePreferences({ ...preferences, operationOverrides: { ...preferences.operationOverrides, [operation]: event.target.value } })}><option value="">Use default model</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control>)}</div></SettingRow>
                </> : section === "publishing" ? <><SettingRow label="Publishing profiles" hint="Character limits show when publishing text approaches this length. The limit is guidance and never prevents copying."><Status label="Profiles are still being migrated" tone="info">Your existing publishing limit remains available in the Article Status Bar. Named, editable profiles are the next persistence step.</Status></SettingRow></> : <><SettingRow label="Active data location" hint="Your data is local. SKLADNO_DATA_DIR is set when Skladno starts; safe relocation belongs to a future Electron update."><Field value="Local Skladno data directory" readOnly /></SettingRow><SettingRow label="Backup destination" hint="Skladno writes backup copies to this folder. You can use a folder already synchronized by Dropbox, OneDrive, or another storage application."><Field value={backupPolicy.destinationPath ?? ""} placeholder="For example, C:\\Skladno backups" onChange={(event) => setBackupPolicy({ ...backupPolicy, destinationPath: event.target.value })} onBlur={() => void saveBackupPolicy(backupPolicy)} /></SettingRow><SettingRow label="Automatic backups" hint="Controls daily backup copies. Manual backups are never removed automatically."><Select value={backupPolicy.schedule} onChange={(event) => void saveBackupPolicy({ ...backupPolicy, schedule: event.target.value as BackupPolicy["schedule"] })}><option value="off">Off</option><option value="daily">Daily</option></Select></SettingRow><SettingRow label="Automatic backup retention" hint="Controls how many automatic backups Skladno keeps. Manual backups are never removed automatically."><Select value={backupPolicy.retention.mode === "unlimited" ? "unlimited" : String(backupPolicy.retention.count)} onChange={(event) => void saveBackupPolicy({ ...backupPolicy, retention: event.target.value === "unlimited" ? { mode: "unlimited" } : { mode: "count", count: Number(event.target.value) } })}><option value="7">Keep 7 backups</option><option value="30">Keep 30 backups</option><option value="90">Keep 90 backups</option><option value="unlimited">Keep all backups</option></Select></SettingRow></>}
            </div>
        </section>
    </main>;
}
