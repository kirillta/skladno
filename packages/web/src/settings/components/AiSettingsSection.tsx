import { builtInSkills, type AiConnection, type ApplicationSettingsSnapshot, type BuiltInSkillId, type ModelPreferences } from "@skladno/shared";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Banner, Button, Field, IconButton, Select } from "../../ui/primitives.js";
import { ChevronDownIcon, CloseIcon, OpenAiIcon, SearchIcon, SettingsIcon, StarIcon } from "../../ui/icons.js";
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


type ModelVendor = "openai" | "other";


function ModelVendorIcon({ vendor }: { vendor: ModelVendor }) {
    if (vendor === "openai")
        return <OpenAiIcon className="size-4" />;

    return <SettingsIcon className="size-4" />;
}


function ModelSelect({ value, models, favorites, sourceVendor, placeholder, allowEmpty = false, disabled, label, "aria-describedby": describedBy, onChange, onFavoritesChange }: { value: string; models: string[]; favorites: string[]; sourceVendor: ModelVendor; placeholder: string; allowEmpty?: boolean; disabled?: boolean; label: string; "aria-describedby"?: string; onChange: (value: string) => void; onFavoritesChange: (favorites: string[]) => void }) {
    const intl = useIntl();
    const [query, setQuery] = useState("");
    const [vendor, setVendor] = useState<ModelVendor | "favorites">(sourceVendor);
    const [open, setOpen] = useState(false);
    const [opensUpward, setOpensUpward] = useState(false);
    const select = useRef<HTMLDetailsElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const selectedLabel = value ? modelLabel(value) : placeholder;
    const tabs: (ModelVendor | "favorites")[] = ["favorites", "openai", "other"];
    const normalizedQuery = query.toLocaleLowerCase();
    const matchesSelectedVendor = vendor === "favorites" ? (model: string) => favorites.includes(model) : () => vendor === sourceVendor;
    const visibleModels = models.filter((model) => modelLabel(model).toLocaleLowerCase().includes(normalizedQuery) && (normalizedQuery.length > 0 || matchesSelectedVendor(model)));
    const vendorLabel = (item: ModelVendor | "favorites") => intl.formatMessage({ id: item === "favorites" ? "settings.favoriteModels" : `settings.modelVendor.${item}` });


    function close() {
        setOpen(false);
    }


    useEffect(() => {
        function closeOnOutsideMouseDown(event: MouseEvent) {
            const popup = select.current;
            if (popup?.open && !event.composedPath().includes(popup))
                setOpen(false);
        }


        document.addEventListener("mousedown", closeOnOutsideMouseDown);
        return () => document.removeEventListener("mousedown", closeOnOutsideMouseDown);
    }, []);


    useEffect(() => {
        setVendor((currentVendor) => currentVendor === "favorites" ? currentVendor : sourceVendor);
    }, [sourceVendor]);

    if (disabled)
        return <div aria-label={label} aria-describedby={describedBy} aria-disabled="true" className="flex min-h-10 w-full items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink opacity-55"><OpenAiIcon className="size-4 shrink-0 text-muted" /><span className="truncate">{selectedLabel}</span><ChevronDownIcon className="absolute right-3 size-4 text-muted" /></div>;

    return <details ref={select} open={open} className="group relative" onKeyDown={(event) => {
        if (event.key === "Escape") {
            close();
            select.current?.querySelector("summary")?.focus();
        }
    }}>
        <summary role="button" aria-label={label} aria-describedby={describedBy} className="flex min-h-10 w-full cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink transition-colors hover:border-brand/45 hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden" onClick={(event) => {
            event.preventDefault();
            setOpensUpward(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 272);
            setOpen(!open);
        }}>
            <OpenAiIcon className="size-4 shrink-0 text-muted" />
            <span className="truncate">{selectedLabel}</span>
            <ChevronDownIcon className="absolute right-3 size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className={`absolute z-10 w-full rounded-control border border-border bg-surface-raised p-1 shadow-raised ${opensUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
            <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Field ref={search} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={intl.formatMessage({ id: "settings.searchModels" })} placeholder={intl.formatMessage({ id: "settings.searchModels" })} className="pl-9 pr-10" />
                {query && <button type="button" aria-label={intl.formatMessage({ id: "settings.clearModelSearch" })} className="absolute right-0 top-1/2 inline-grid size-9 -translate-y-1/2 place-items-center rounded-control border border-transparent p-1 text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                    setQuery("");
                    search.current?.focus();
                }}><CloseIcon className="size-4" /></button>}
            </div>
            <div className="mt-1 grid h-52 grid-cols-[3rem_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col items-center gap-1 overflow-x-hidden overflow-y-auto border-r border-border [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong [&::-webkit-scrollbar]:w-2" role="tablist" aria-label={intl.formatMessage({ id: "settings.modelVendorFilters" })} aria-orientation="vertical">
                    {tabs.map((item) => <button key={item} type="button" role="tab" title={vendorLabel(item)} aria-label={vendorLabel(item)} aria-selected={vendor === item} className={`flex size-9 shrink-0 items-center justify-center rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${vendor === item ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"}`} onClick={() => setVendor(item)}>{item === "favorites" ? <StarIcon className="size-4" /> : <ModelVendorIcon vendor={item} />}</button>)}
                </div>
                <div className="min-h-0 overflow-y-auto pl-1 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong [&::-webkit-scrollbar]:w-2" role="listbox" aria-label={label}>
                    {allowEmpty && <button type="button" role="option" aria-selected={!value} className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-sm text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                        onChange("");
                        close();
                    }}>{placeholder}</button>}
                    {visibleModels.map((model) => <div key={model} className="flex items-center gap-1"><button type="button" role="option" aria-selected={model === value} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                        onChange(model);
                        close();
                    }}><OpenAiIcon className="size-4 shrink-0 text-muted" /><span className="truncate">{modelLabel(model)}</span></button><IconButton label={intl.formatMessage({ id: favorites.includes(model) ? "settings.removeFavoriteModel" : "settings.addFavoriteModel" }, { model: modelLabel(model) })} aria-pressed={favorites.includes(model)} className={favorites.includes(model) ? "text-brand" : undefined} onClick={() => onFavoritesChange(favorites.includes(model) ? favorites.filter((favorite) => favorite !== model) : [...favorites, model])}><StarIcon className={favorites.includes(model) ? "size-4 fill-current" : "size-4"} /></IconButton></div>)}
                    {visibleModels.length === 0 && <p className="px-2 py-3 text-sm text-muted" role="status">{intl.formatMessage({ id: "settings.noMatchingModels" })}</p>}
                </div>
            </div>
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
    const activeConnection = settings.connections.find((connection) => connection.id === settings.activeConnectionId);
    const sourceVendor: ModelVendor = activeConnection && activeConnection.provider !== "openai" ? "other" : "openai";


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
                    <ModelSelect value={preferences.defaultModel} models={models} favorites={preferences.favoriteModels ?? []} sourceVendor={sourceVendor} disabled={models.length === 0} label={intl.formatMessage({ id: "settings.model" })} placeholder={models.length === 0 ? intl.formatMessage({ id: "settings.noModels" }) : intl.formatMessage({ id: "settings.chooseModel" })} onChange={(defaultModel) => void savePreferences({ ...preferences, defaultModel })} onFavoritesChange={(favoriteModels) => void savePreferences({ ...preferences, favoriteModels })} />
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
                    <ModelSelect value={preferences.textGenerationModel ?? ""} models={models} favorites={preferences.favoriteModels ?? []} sourceVendor={sourceVendor} allowEmpty disabled={models.length === 0} label={intl.formatMessage({ id: "settings.textGenerationModel" })} placeholder={intl.formatMessage({ id: "settings.useDefaultModel" })} onChange={(textGenerationModel) => void savePreferences({ ...preferences, textGenerationModel: textGenerationModel || undefined })} onFavoritesChange={(favoriteModels) => void savePreferences({ ...preferences, favoriteModels })} />
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
                                <ModelSelect value={preferences.skillOverrides[skill] ?? ""} models={models} favorites={preferences.favoriteModels ?? []} sourceVendor={sourceVendor} allowEmpty label={intl.formatMessage({ id: skillMessages[skill].label })} placeholder={intl.formatMessage({ id: "settings.useDefaultModel" })} onChange={(model) => void savePreferences({ ...preferences, skillOverrides: { ...preferences.skillOverrides, [skill]: model } })} onFavoritesChange={(favoriteModels) => void savePreferences({ ...preferences, favoriteModels })} />
                            </SettingRow>)}
                        </div>
                    </div>
                </div>
            </SettingsGroup>
        </div>
    </>;
}
