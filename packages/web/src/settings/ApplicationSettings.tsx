import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot, type BackupPolicy, type GeneralSettings } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Button, Field, Select, Status } from "../ui/primitives.js";

type Section = "general" | "ai" | "publishing" | "backups";
const sections: { id: Section; label: string }[] = [
    { id: "general", label: "General" },
    { id: "ai", label: "AI" },
    { id: "publishing", label: "Publishing profiles" },
    { id: "backups", label: "Data & backups" }
];

function SettingRow({ label, hint, children, status }: { label: string; hint: string; children: ReactNode; status?: string }) {
    const hintId = useId();
    return <div className="border-b border-border py-5 last:border-b-0">
        <label className="block text-sm font-semibold text-ink">{label}</label>
        <p id={hintId} className="mt-1 max-w-2xl text-sm leading-5 text-muted">{hint}</p>
        <div className="mt-3 max-w-md">{isValidElement(children) ? cloneElement(children, { "aria-describedby": hintId }) : children}</div>
        {status && <p className="mt-2 text-xs text-muted" role="status">{status}</p>}
    </div>;
}

function dateExample(general: GeneralSettings): string {
    return new Intl.DateTimeFormat("en", {
        dateStyle: general.dateFormat === "iso" ? undefined : "medium",
        year: general.dateFormat === "iso" ? "numeric" : undefined,
        month: general.dateFormat === "iso" ? "2-digit" : undefined,
        day: general.dateFormat === "iso" ? "2-digit" : undefined,
        hour: "numeric", minute: "2-digit",
        hour12: general.timeFormat === "12-hour" ? true : general.timeFormat === "24-hour" ? false : undefined
    }).format(new Date("2026-07-31T15:45:00Z"));
}

export function ApplicationSettings({ client, back }: { client: EditorialWorkspaceClient; back: () => void }) {
    const [section, setSection] = useState<Section>("general");
    const [snapshot, setSnapshot] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState<GeneralSettings>(defaultGeneralSettings);
    const [backup, setBackup] = useState<BackupPolicy>({ schedule: "off", retention: { mode: "count", count: 7 } });
    const [status, setStatus] = useState("Loading settings…");
    const timer = useRef<number>();

    useEffect(() => {
        client.getApplicationSettings().then((loaded) => {
            setSnapshot(loaded);
            setGeneral(loaded.general);
            setBackup(loaded.backupPolicy);
            setStatus("Saved");
        }).catch(() => setStatus("Couldn’t load settings. Try returning to the workspace and opening Settings again."));
    }, [client]);

    function saveGeneral(next: GeneralSettings, immediate = false) {
        setGeneral(next);
        window.clearTimeout(timer.current);
        setStatus("Saving…");
        const save = () => client.updateGeneralSettings(next).then(() => setStatus("Saved")).catch(() => setStatus("Couldn’t save. Your changes are still here; try again."));
        if (immediate)
            void save();
        else
            timer.current = window.setTimeout(() => void save(), 500);
    }

    function saveBackup(next: BackupPolicy) {
        setBackup(next);
        setStatus("Saving…");
        void client.updateBackupPolicy(next).then(() => setStatus("Saved")).catch(() => setStatus("Couldn’t save. Your changes are still here; try again."));
    }

    return <main className="flex h-dvh overflow-hidden bg-surface text-ink">
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-raised md:flex md:flex-col" aria-label="Settings Navigation">
            <header className="flex min-h-18 items-center border-b border-border px-3"><Button variant="quiet" onClick={back}>Back to workspace</Button></header>
            <nav className="p-2">{sections.map((item) => <button key={item.id} className={`min-h-10 w-full rounded-control px-3 text-left text-sm ${section === item.id ? "bg-brand-soft font-semibold text-brand" : "text-muted hover:bg-surface"}`} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex min-h-18 items-center justify-between border-b border-border px-4 md:hidden">
                <Button variant="quiet" onClick={back}>Back</Button>
                <Select aria-label="Settings section" value={section} onChange={(event) => setSection(event.target.value as Section)} className="w-48">{sections.map((item) =>
                    <option key={item.id} value={item.id}>{item.label}</option>)}
                </Select>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
                    <header className="mb-7">
                        <p className="text-micro font-semibold uppercase tracking-overline text-brand">Application Settings</p>
                        <h1 className="mt-2 text-2xl font-semibold">{sections.find((item) => item.id === section)?.label}</h1>
                        <p className="mt-2 text-sm text-muted">{status}</p>
                    </header>
                    {!snapshot && status.startsWith("Loading") ? null : section === "general" ? <>
                        <SettingRow label="Preferred appearance" hint="Choose the appearance you want Skladno to use. Your preference will be remembered, but visual themes will be enabled in a later update."><Select value={general.theme} onChange={(event) => saveGeneral({ ...general, theme: event.target.value as GeneralSettings["theme"] }, true)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></SettingRow>
                        <SettingRow label="Interface language" hint="Changes the language of Skladno’s controls and messages. English is the only complete interface language for now."><Select value="en" disabled><option>English</option></Select></SettingRow>
                        <SettingRow label="Date format" hint="Changes how dates are shown in Skladno. It does not change the saved date or revision history." status={`Example: ${dateExample(general)}`}><Select value={general.dateFormat} onChange={(event) => saveGeneral({ ...general, dateFormat: event.target.value as GeneralSettings["dateFormat"] }, true)}><option value="system">System</option><option value="day-first">Day first</option><option value="month-first">Month first</option><option value="iso">ISO</option></Select></SettingRow>
                        <SettingRow label="Time format" hint="Changes how times are shown in Skladno. It does not change saved dates or revision history."><Select value={general.timeFormat} onChange={(event) => saveGeneral({ ...general, timeFormat: event.target.value as GeneralSettings["timeFormat"] }, true)}><option value="system">System</option><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></Select></SettingRow>
                        <SettingRow label="Default Article language" hint="Used for new Articles when you do not choose a language yourself. Existing Articles are not changed."><Select value={general.defaultArticleLanguage} onChange={(event) => saveGeneral({ ...general, defaultArticleLanguage: event.target.value, defaultTranslationLanguages: general.defaultTranslationLanguages.filter((language) => language !== event.target.value) }, true)}>{[["en", "English"], ["es", "Spanish"], ["pt", "Portuguese"], ["ru", "Russian"], ["fr", "French"], ["de", "German"], ["it", "Italian"]].map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select></SettingRow>
                    </> : section === "ai" ? <><SettingRow label="OpenAI connection" hint="New AI requests use your active connection. Skladno stores only the environment-variable name, never an API key value."><Status label="OpenAI connection" tone="info">Configure `OPENAI_API_KEY` when starting the local service. Connection management will be available here as the server contract is completed.</Status></SettingRow><SettingRow label="Default model" hint="Used for AI work unless you choose a different model for a specific operation."><Field value={snapshot?.modelPreferences.defaultModel ?? ""} disabled placeholder="No model configured" /></SettingRow></> : section === "publishing" ? <SettingRow label="Publishing profiles" hint="Character limits show when publishing text approaches a length. They are guidance and never prevent copying."><Status label="Profiles" tone="info">Existing LinkedIn character-limit profiles remain available while editable profiles are being migrated.</Status></SettingRow> : <><SettingRow label="Active data location" hint="Your data is local. SKLADNO_DATA_DIR is set when Skladno starts; safe relocation belongs to the Electron update."><Field value="Local Skladno data directory" readOnly /></SettingRow><SettingRow label="Backup destination" hint="Skladno writes backup copies to this folder. You can use a folder already synchronized by Dropbox, OneDrive, or another storage application."><Field value={backup.destinationPath ?? ""} onChange={(event) => setBackup({ ...backup, destinationPath: event.target.value })} onBlur={() => saveBackup(backup)} placeholder="C:\\Backups" /></SettingRow><SettingRow label="Automatic backups" hint="Controls daily backup copies. Manual backups are never removed automatically."><Select value={backup.schedule} onChange={(event) => saveBackup({ ...backup, schedule: event.target.value as BackupPolicy["schedule"] })}><option value="off">Off</option><option value="daily">Daily</option></Select></SettingRow></>}
                </div>
            </div>
        </section>
    </main>;
}
