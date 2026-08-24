import { builtInSkills, type AiConnection, type ApplicationSettingsSnapshot, type BuiltInSkillId, type ModelPreferences } from "@skladno/shared";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Banner, Button, Field, Select } from "../../ui/primitives.js";
import { ChevronDownIcon, OpenAiIcon } from "../../ui/icons.js";
import { Control, SettingRow, SettingsGroup } from "./SettingRow.js";

const skillMessages: Record<BuiltInSkillId, { label: "assistant.skill.talkingPoints.label" | "assistant.skill.narrativeDraft.label" | "assistant.skill.flowAndClarity.label" | "assistant.skill.factChecking.label" | "assistant.skill.styleReview.label" | "assistant.skill.translation.label"; hint: "assistant.skill.talkingPoints.hint" | "assistant.skill.narrativeDraft.hint" | "assistant.skill.flowAndClarity.hint" | "assistant.skill.factChecking.hint" | "assistant.skill.styleReview.hint" | "assistant.skill.translation.hint" }> = {
    talking_points: { label: "assistant.skill.talkingPoints.label", hint: "assistant.skill.talkingPoints.hint" },
    narrative_draft: { label: "assistant.skill.narrativeDraft.label", hint: "assistant.skill.narrativeDraft.hint" },
    flow_and_clarity: { label: "assistant.skill.flowAndClarity.label", hint: "assistant.skill.flowAndClarity.hint" },
    fact_checking: { label: "assistant.skill.factChecking.label", hint: "assistant.skill.factChecking.hint" },
    style_review: { label: "assistant.skill.styleReview.label", hint: "assistant.skill.styleReview.hint" },
    translation: { label: "assistant.skill.translation.label", hint: "assistant.skill.translation.hint" },
};

type ConnectionMethod = "managed" | "environment-variable";


function pasteIntoField(current: string, pasted: string, selectionStart: number | null, selectionEnd: number | null): string {
    const start = selectionStart ?? current.length;
    const end = selectionEnd ?? start;

    return `${current.slice(0, start)}${pasted}${current.slice(end)}`;
}


function credentialSource(connection: AiConnection): AiConnection["credentialSource"] {
    if (connection.credentialSource)
        return connection.credentialSource;

    const legacy = connection as unknown as { environmentVariableName?: string };
    return { kind: "environment-variable", environmentVariableName: legacy.environmentVariableName ?? "" };
}


function credentialSourceLabel(connection: AiConnection, managedLabel: string): string {
    const source = credentialSource(connection);
    return source.kind === "environment-variable" ? source.environmentVariableName : managedLabel;
}


function modelLabel(model: string): string {
    return model.replace(/^(gpt|o)-?([\d.]+)(?:-(mini|nano))?$/i, (_match, family: string, version: string, size?: string) => `${family.toUpperCase() === "GPT" ? "GPT" : family.toLowerCase()}-${version}${size ? ` ${size}` : ""}`);
}


function supportsReasoning(model: string): boolean {
    return /^(gpt-5|o[134])(?:-|$)/i.test(model);
}


function isReasoningEffort(value: string): value is "low" | "medium" | "high" {
    return value === "low" || value === "medium" || value === "high";
}


function ModelSelect({ value, models, placeholder, disabled, label, "aria-describedby": describedBy, onChange }: { value: string; models: string[]; placeholder: string; disabled?: boolean; label: string; "aria-describedby"?: string; onChange: (value: string) => void }) {
    const selectedLabel = value ? modelLabel(value) : placeholder;

    if (disabled)
        return <div aria-label={label} aria-describedby={describedBy} aria-disabled="true" className="flex min-h-10 w-full items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink opacity-55"><OpenAiIcon className="size-4 shrink-0 text-muted" /><span className="truncate">{selectedLabel}</span><ChevronDownIcon className="absolute right-3 size-4 text-muted" /></div>;

    return <details className="group relative">
        <summary role="button" aria-label={label} aria-describedby={describedBy} className="flex min-h-10 w-full cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink transition-colors hover:border-brand/45 hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <OpenAiIcon className="size-4 shrink-0 text-muted" />
            <span className="truncate">{selectedLabel}</span>
            <ChevronDownIcon className="absolute right-3 size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="listbox" aria-label={label}>
            <button type="button" role="option" aria-selected={!value} className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-sm text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={(event) => {
                onChange("");
                event.currentTarget.closest("details")?.removeAttribute("open");
            }}>{placeholder}</button>
            {models.map((model) => <button key={model} type="button" role="option" aria-selected={model === value} className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={(event) => {
                onChange(model);
                event.currentTarget.closest("details")?.removeAttribute("open");
            }}><OpenAiIcon className="size-4 shrink-0 text-muted" /><span className="truncate">{modelLabel(model)}</span></button>)}
        </div>
    </details>;
}


export function AiSettingsSection({ settings, preferences, models, connectionName, environmentName, managedConnectionName, apiKey, connectionError, setConnectionName, setEnvironmentName, setManagedConnectionName, setApiKey, onAddConnection, onAddManagedConnection, onSetActiveConnection, onRequestConnectionRename, canRenameManagedConnection, onRequestConnectionRemoval, onRefreshModels, savePreferences }: {
    settings: ApplicationSettingsSnapshot;
    preferences: ModelPreferences;
    models: string[];
    connectionName: string;
    environmentName: string;
    managedConnectionName: string;
    apiKey: string;
    connectionError?: string;
    setConnectionName: (value: string) => void;
    setEnvironmentName: (value: string) => void;
    setManagedConnectionName: (value: string) => void;
    setApiKey: (value: string) => void;
    onAddConnection: () => void;
    onAddManagedConnection?: () => void;
    onSetActiveConnection: (connectionId: string) => void;
    onRequestConnectionRename?: (connection: AiConnection) => void;
    canRenameManagedConnection: boolean;
    onRequestConnectionRemoval: (connection: AiConnection) => void;
    onRefreshModels: () => void;
    savePreferences: (next: ModelPreferences) => Promise<void>;
}) {
    const intl = useIntl();
    const [specificModelsOpen, setSpecificModelsOpen] = useState(false);
    const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod | undefined>(onAddManagedConnection ? undefined : "environment-variable");
    const specificModelsContent = useRef<HTMLDivElement>(null);


    function toggleSpecificModels() {
        const nextOpen = !specificModelsOpen;
        setSpecificModelsOpen(nextOpen);

        if (nextOpen) {
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.setTimeout(() => specificModelsContent.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }), reducedMotion ? 0 : 220);
        }
    }


    return <>
        <SettingsGroup label={intl.formatMessage({ id: "settings.connections" })}>
            {settings.connections.length > 0 && <div className="mt-6 mb-8">
                <div>
                    <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.configuredConnections" })}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.configuredConnectionsHint" })}</p>
                </div>
                <div className="mt-4 grid gap-2">{settings.connections.filter((connection): connection is AiConnection => Boolean(connection)).map((connection) => <div key={connection.id} className="flex flex-col gap-3 rounded-control border border-border bg-surface-raised px-3 py-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{connection.label}</p>
                            {connection.id === settings.activeConnectionId && <p className="inline-flex min-h-8 items-center rounded-control border border-brand bg-brand-soft px-2 py-1 text-xs font-semibold text-brand" role="status">{intl.formatMessage({ id: "settings.activeConnectionShort" })}</p>}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">{credentialSourceLabel(connection, intl.formatMessage({ id: "settings.managedCredential" }))}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        {onRequestConnectionRename && (credentialSource(connection).kind !== "managed" || canRenameManagedConnection) && <Button className="!px-2" variant="quiet" onClick={() => onRequestConnectionRename(connection)}>{intl.formatMessage({ id: "settings.renameConnectionShort" })}</Button>}
                        {connection.id !== settings.activeConnectionId && <><Button className="!px-2" variant="quiet" onClick={() => onSetActiveConnection(connection.id)}>{intl.formatMessage({ id: "settings.useConnectionShort" })}</Button><Button className="!px-2" variant="danger" onClick={() => onRequestConnectionRemoval(connection)}>{intl.formatMessage({ id: "settings.removeConnectionShort" })}</Button></>}
                    </div>
                </div>)}</div>
            </div>}
            {onAddManagedConnection && <div className="mt-6">
                <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.chooseConnectionMethod" })}</h3>
                <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.chooseConnectionMethodHint" })}</p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={intl.formatMessage({ id: "settings.chooseConnectionMethod" })}>
                    <Button variant={connectionMethod === "managed" ? "secondary" : "quiet"} aria-pressed={connectionMethod === "managed"} onClick={() => setConnectionMethod("managed")}>{intl.formatMessage({ id: "settings.apiKey" })}</Button>
                    <Button variant={connectionMethod === "environment-variable" ? "secondary" : "quiet"} aria-pressed={connectionMethod === "environment-variable"} onClick={() => setConnectionMethod("environment-variable")}>{intl.formatMessage({ id: "settings.environmentVariable" })}</Button>
                </div>
            </div>}
            {connectionMethod === "managed" && <div className="mt-6 mb-8">
                <div>
                    <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.addApiKey" })}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.addApiKeyHint" })}</p>
                </div>
                <div className="mt-4 border-l border-border-strong pl-4">
                    <div className="grid gap-4">
                        <Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}>
                            <Field type="text" value={managedConnectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => setManagedConnectionName(event.target.value)} />
                        </Control>
                        <Control label={intl.formatMessage({ id: "settings.apiKey" })} hint={intl.formatMessage({ id: "settings.apiKeyHint" })}>
                            <Field type="password" value={apiKey} placeholder={intl.formatMessage({ id: "settings.apiKeyPlaceholder" })} autoComplete="off" onChange={(event) => setApiKey(event.target.value)} />
                        </Control>
                    </div>
                    <div className="mt-4">
                        <Button className="w-fit" variant="secondary" onClick={onAddManagedConnection}>{intl.formatMessage({ id: "settings.addApiKeyButton" })}</Button>
                    </div>
                </div>
            </div>}
            {connectionMethod === "environment-variable" && <div className="mt-6 mb-8">
                <div>
                    <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.addConnection" })}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.connectionHint" })}</p>
                </div>
                <div className="mt-4 border-l border-border-strong pl-4">
                    <div className="grid gap-4">
                        <Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}>
                            <Field type="text" readOnly={false} value={connectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => setConnectionName(event.target.value)} onPaste={(event) => {
                                const pasted = event.clipboardData.getData("text");
                                if (!pasted)
                                    return;

                                event.preventDefault();
                                setConnectionName(pasteIntoField(connectionName, pasted, event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
                            }} />
                        </Control>
                        <Control label={intl.formatMessage({ id: "settings.environmentName" })} hint={intl.formatMessage({ id: "settings.environmentNameHint" })}>
                            <Field type="text" readOnly={false} value={environmentName} placeholder={intl.formatMessage({ id: "settings.environmentNamePlaceholder" })} onChange={(event) => setEnvironmentName(event.target.value)} onPaste={(event) => {
                                const pasted = event.clipboardData.getData("text");
                                if (!pasted)
                                    return;

                                event.preventDefault();
                                setEnvironmentName(pasteIntoField(environmentName, pasted, event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
                            }} />
                        </Control>
                    </div>
                    {connectionError && <Banner className="mt-4" tone="warning" role="alert"><span>{connectionError}</span></Banner>}
                    <div className="mt-4">
                        <Button className="w-fit" variant="secondary" onClick={onAddConnection}>{intl.formatMessage({ id: "settings.addConnectionButton" })}</Button>
                    </div>
                </div>
            </div>}
        </SettingsGroup>
        <div className="pt-8">
            <SettingsGroup label={intl.formatMessage({ id: "settings.models" })}>
                <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.defaultModel" })} hint={intl.formatMessage({ id: "settings.defaultModelHint" })}>
                    <ModelSelect value={preferences.defaultModel} models={models} disabled={models.length === 0} label={intl.formatMessage({ id: "settings.model" })} placeholder={models.length === 0 ? intl.formatMessage({ id: "settings.noModels" }) : intl.formatMessage({ id: "settings.chooseModel" })} onChange={(defaultModel) => void savePreferences({ ...preferences, defaultModel })} />
                    <Button className="mt-3 w-fit" variant="secondary" onClick={onRefreshModels}>{intl.formatMessage({ id: "settings.refreshModels" })}</Button>
                </SettingRow>
                {supportsReasoning(preferences.defaultModel) && <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.reasoningEffort" })} hint={intl.formatMessage({ id: "settings.reasoningEffortHint" })}>
                    <Select aria-label={intl.formatMessage({ id: "settings.reasoningEffort" })} value={preferences.reasoningEffort ?? "medium"} onChange={(event) => {
                        if (isReasoningEffort(event.target.value))
                            void savePreferences({ ...preferences, reasoningEffort: event.target.value });
                    }}>
                        <option value="low">{intl.formatMessage({ id: "settings.reasoningLow" })}</option>
                        <option value="medium">{intl.formatMessage({ id: "settings.reasoningMedium" })}</option>
                        <option value="high">{intl.formatMessage({ id: "settings.reasoningHigh" })}</option>
                    </Select>
                </SettingRow>}
                <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.textGenerationModel" })} hint={intl.formatMessage({ id: "settings.textGenerationModelHint" })}>
                    <ModelSelect value={preferences.textGenerationModel ?? ""} models={models} disabled={models.length === 0} label={intl.formatMessage({ id: "settings.textGenerationModel" })} placeholder={intl.formatMessage({ id: "settings.useDefaultModel" })} onChange={(textGenerationModel) => void savePreferences({ ...preferences, textGenerationModel: textGenerationModel || undefined })} />
                </SettingRow>
                <div className="mt-8">
                    <button type="button" aria-expanded={specificModelsOpen} aria-controls="specific-model-overrides" className="group flex min-h-9 w-full items-center gap-2 text-left text-sm font-semibold hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={toggleSpecificModels}>
                        <span>{intl.formatMessage({ id: "settings.specificModels" })}</span>
                        <ChevronDownIcon className={`ml-auto size-4 shrink-0 text-brand transition-transform duration-200 motion-reduce:transition-none ${specificModelsOpen ? "rotate-180" : ""}`} />
                    </button>
                    <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.specificModelsHint" })}</p>
                    <div ref={specificModelsContent} id="specific-model-overrides" aria-hidden={!specificModelsOpen} className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${specificModelsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="min-h-0 overflow-hidden pt-2">
                            {builtInSkills.map((skill) => <SettingRow key={skill} headingLevel={3} label={intl.formatMessage({ id: skillMessages[skill].label })} hint={intl.formatMessage({ id: skillMessages[skill].hint })}>
                                <ModelSelect value={preferences.skillOverrides[skill] ?? ""} models={models} label={intl.formatMessage({ id: skillMessages[skill].label })} placeholder={intl.formatMessage({ id: "settings.useDefaultModel" })} onChange={(model) => void savePreferences({ ...preferences, skillOverrides: { ...preferences.skillOverrides, [skill]: model } })} />
                            </SettingRow>)}
                        </div>
                    </div>
                </div>
            </SettingsGroup>
        </div>
    </>;
}
