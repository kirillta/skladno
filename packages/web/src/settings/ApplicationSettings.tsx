/* eslint-disable @stylistic/max-statements-per-line */

import { useEffect, useState } from "react";
import { defaultGeneralSettings, type ApplicationSettingsSnapshot, type GeneralSettings, type ModelPreferences } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../application-client.js";
import { Button, Field, Select, Status } from "../ui/primitives.js";

const operations = [["thesis_to_narrative", "Thesis to narrative"], ["flow_revision", "Flow revision"], ["fact_check", "Fact check"], ["style_review", "Style review"], ["translation", "Translation"]] as const;
type Section = "general" | "ai" | "publishing" | "backups";

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
    return <section className="border-b border-border py-5 last:border-b-0"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{hint}</p><div className="mt-3 max-w-md">{children}</div></section>;
}

export function ApplicationSettings({ client, back }: { client: EditorialWorkspaceClient; back: () => void }) {
    const [section, setSection] = useState<Section>("general");
    const [settings, setSettings] = useState<ApplicationSettingsSnapshot>();
    const [general, setGeneral] = useState<GeneralSettings>(defaultGeneralSettings);
    const [preferences, setPreferences] = useState<ModelPreferences>({ defaultModel: "gpt-5", operationOverrides: {} });
    const [models, setModels] = useState(["gpt-5"]);
    const [connectionName, setConnectionName] = useState("");
    const [environmentName, setEnvironmentName] = useState("");
    const [status, setStatus] = useState("Loading settings…");

    useEffect(() => {
        void client.getApplicationSettings().then((loaded) => {
            setSettings(loaded);
            setGeneral(loaded.general);
            setPreferences(loaded.modelPreferences.defaultModel ? loaded.modelPreferences : { ...loaded.modelPreferences, defaultModel: "gpt-5" });
            setStatus("Saved");
        }).catch(() => setStatus("Couldn’t load settings."));
    }, [client]);

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

    return <main className="flex h-dvh overflow-hidden bg-surface text-ink"><aside className="hidden w-52 shrink-0 border-r border-border bg-surface-supporting md:flex md:flex-col"><header className="flex min-h-18 items-center border-b border-border px-3"><Button variant="quiet" onClick={back}>Back to workspace</Button></header><nav className="p-2">{(["general", "ai", "publishing", "backups"] as const).map((item) => <button key={item} className={`min-h-10 w-full rounded-control px-3 text-left text-sm ${section === item ? "bg-brand-soft font-semibold text-brand" : "text-muted"}`} onClick={() => setSection(item)}>{item === "publishing" ? "Publishing profiles" : item === "backups" ? "Data & backups" : item === "ai" ? "AI" : "General"}</button>)}</nav><footer className="mt-auto border-t border-border px-4 py-3 text-micro text-muted" role="status"><span aria-hidden="true">&#9679;</span> {status}</footer></aside><section className="min-w-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong"><div className="mx-auto w-full max-w-3xl px-5 py-8"><h1 className="text-2xl font-semibold">{section === "ai" ? "AI" : section === "general" ? "General" : section === "publishing" ? "Publishing profiles" : "Data & backups"}</h1>{!settings ? null : section === "ai" ? <><Row title="Add an OpenAI connection" hint="Your OpenAI key stays private on this computer. Skladno only stores the name of where it is kept."><div className="grid gap-4"><div><label htmlFor="connection-name" className="text-sm font-medium">Connection name</label><p className="mt-1 text-xs text-muted">A familiar name for this connection.</p><Field id="connection-name" value={connectionName} placeholder="For example, Personal OpenAI" onChange={(event) => setConnectionName(event.target.value)} /></div><div><label htmlFor="environment-name" className="text-sm font-medium">Environment-variable name</label><p className="mt-1 text-xs text-muted">The name used when your local service starts. Your key is never displayed.</p><Field id="environment-name" value={environmentName} placeholder="For example, OPENAI_API_KEY" onChange={(event) => setEnvironmentName(event.target.value)} /></div><Button variant="secondary" onClick={() => void client.addOpenAiConnection({ label: connectionName, environmentVariableName: environmentName })}>Add connection</Button></div></Row><Row title="Default model" hint="Used for AI work unless a task has its own model choice."><div><label htmlFor="default-model" className="text-sm font-medium">Model</label><Select id="default-model" value={preferences.defaultModel} onChange={(event) => void savePreferences({ ...preferences, defaultModel: event.target.value })}>{models.map((model) => <option key={model}>{model}</option>)}</Select><Button className="mt-2" variant="secondary" onClick={() => void client.refreshOpenAiModels().then(setModels)}>Refresh available models</Button></div></Row><Row title="Models for specific tasks" hint="Choose a model for a task, or use the default model. This affects future AI requests only."><div className="grid gap-4">{operations.map(([operation, label]) => <div key={operation}><label htmlFor={`model-${operation}`} className="text-sm font-medium">{label}</label><Select id={`model-${operation}`} value={preferences.operationOverrides[operation] ?? ""} onChange={(event) => void savePreferences({ ...preferences, operationOverrides: { ...preferences.operationOverrides, [operation]: event.target.value } })}><option value="">Use default model</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></div>)}</div></Row></> : section === "general" ? <><Row title="Preferred appearance" hint="Choose the appearance you want Skladno to use. Your preference will be remembered, but visual themes will be enabled in a later update."><Select value={general.theme} onChange={(event) => {
        const next = { ...general, theme: event.target.value as GeneralSettings["theme"] };
        setGeneral(next);
        void client.updateGeneralSettings(next);
    }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></Row><Row title="Interface language" hint="Changes the language of Skladno’s controls and messages. English is the only complete interface language for now."><Select value="en" disabled><option>English</option></Select></Row><Row title="Date format" hint="Changes how dates are shown in Skladno. It does not change saved dates or revision history."><Select value={general.dateFormat} onChange={(event) => {
        const next = { ...general, dateFormat: event.target.value as GeneralSettings["dateFormat"] }; setGeneral(next); void client.updateGeneralSettings(next);
    }}><option value="system">System</option><option value="day-first">Day first</option><option value="month-first">Month first</option><option value="iso">ISO</option></Select></Row><Row title="Time format" hint="Changes how times are shown in Skladno. It does not change saved dates or revision history."><Select value={general.timeFormat} onChange={(event) => {
        const next = { ...general, timeFormat: event.target.value as GeneralSettings["timeFormat"] }; setGeneral(next); void client.updateGeneralSettings(next);
    }}><option value="system">System</option><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></Select></Row><Row title="Default Article language" hint="Used for new Articles when you do not choose a language yourself. Existing Articles are not changed."><Select value={general.defaultArticleLanguage} onChange={(event) => {
        const next = { ...general, defaultArticleLanguage: event.target.value }; setGeneral(next); void client.updateGeneralSettings(next);
    }}><option value="en">English</option><option value="es">Spanish</option><option value="pt">Portuguese</option><option value="ru">Russian</option><option value="fr">French</option><option value="de">German</option><option value="it">Italian</option></Select></Row></> : <Status label="Coming next" tone="info">This settings section is still being completed.</Status>}</div></section></main>;
}
