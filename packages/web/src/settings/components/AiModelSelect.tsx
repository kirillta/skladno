/* eslint-disable @stylistic/max-statements-per-line */
import { AI_PROVIDER, type AiProvider, type AvailableAiModel, type ModelPreferences } from "@skladno/shared";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Field, IconButton, Select } from "../../ui/primitives.js";
import { AnthropicIcon, ChevronDownIcon, CloseIcon, DeepSeekIcon, GoogleIcon, OpenAiIcon, OpenCodeIcon, SearchIcon, StarIcon, XaiIcon } from "../../ui/icons.js";

const providerMessages: Record<AiProvider, "settings.provider.openai" | "settings.provider.opencode" | "settings.provider.anthropic" | "settings.provider.google" | "settings.provider.xai" | "settings.provider.deepseek"> = {
    [AI_PROVIDER.OPENAI]: "settings.provider.openai", [AI_PROVIDER.OPENCODE]: "settings.provider.opencode", [AI_PROVIDER.ANTHROPIC]: "settings.provider.anthropic", [AI_PROVIDER.GOOGLE]: "settings.provider.google", [AI_PROVIDER.XAI]: "settings.provider.xai", [AI_PROVIDER.DEEPSEEK]: "settings.provider.deepseek",
};

const skillMessages: Record<"talking_points" | "narrative_draft" | "flow_and_clarity" | "fact_checking" | "style_review" | "translation", { label: "assistant.skill.talkingPoints.label" | "assistant.skill.narrativeDraft.label" | "assistant.skill.flowAndClarity.label" | "assistant.skill.factChecking.label" | "assistant.skill.styleReview.label" | "assistant.skill.translation.label"; hint: "assistant.skill.talkingPoints.hint" | "assistant.skill.narrativeDraft.hint" | "assistant.skill.flowAndClarity.hint" | "assistant.skill.factChecking.hint" | "assistant.skill.styleReview.hint" | "assistant.skill.translation.hint" }> = {
    talking_points: {
        label: "assistant.skill.talkingPoints.label",
        hint: "assistant.skill.talkingPoints.hint"
    },
    narrative_draft: {
        label: "assistant.skill.narrativeDraft.label",
        hint: "assistant.skill.narrativeDraft.hint"
    },
    flow_and_clarity: {
        label: "assistant.skill.flowAndClarity.label",
        hint: "assistant.skill.flowAndClarity.hint"
    },
    fact_checking: {
        label: "assistant.skill.factChecking.label",
        hint: "assistant.skill.factChecking.hint"
    },
    style_review: {
        label: "assistant.skill.styleReview.label",
        hint: "assistant.skill.styleReview.hint"
    },
    translation: {
        label: "assistant.skill.translation.label",
        hint: "assistant.skill.translation.hint"
    },
};

type ModelVendor = Exclude<AiProvider, "opencode"> | "other";


function modelLabel(model: string): string {
    return model.replace(/^(gpt|o)-?([\d.]+)(?:-(mini|nano))?$/i, (_match, family: string, version: string, size?: string) => `${family.toUpperCase() === "GPT" ? "GPT" : family.toLowerCase()}-${version}${size ? ` ${size}` : ""}`);
}


function modelProvider(model: string, connectionProvider: AiProvider): AiProvider {
    if (connectionProvider !== AI_PROVIDER.OPENCODE)
        return connectionProvider;

    const id = model.replace(/^opencode\//, "");
    if (id.startsWith("gpt-"))
        return AI_PROVIDER.OPENAI;

    if (id.startsWith("claude-"))
        return AI_PROVIDER.ANTHROPIC;

    if (id.startsWith("gemini-"))
        return AI_PROVIDER.GOOGLE;

    if (id.startsWith("grok-"))
        return AI_PROVIDER.XAI;

    if (id.startsWith("deepseek-"))
        return AI_PROVIDER.DEEPSEEK;

    return AI_PROVIDER.OPENCODE;
}


function modelVendor(provider: AiProvider): ModelVendor {
    return provider === AI_PROVIDER.OPENCODE ? "other" : provider;
}


function ProviderMark({ provider, className, viaProvider }: { provider: AiProvider; className: string; viaProvider?: AiProvider }) {
    const props = { "data-provider": provider, ...(viaProvider ? { "data-via-provider": viaProvider } : {}), className };
    switch (provider) {
        case AI_PROVIDER.OPENAI: return <OpenAiIcon {...props} />;
        case AI_PROVIDER.OPENCODE: return <OpenCodeIcon {...props} />;
        case AI_PROVIDER.ANTHROPIC: return <AnthropicIcon {...props} />;
        case AI_PROVIDER.GOOGLE: return <GoogleIcon {...props} />;
        case AI_PROVIDER.XAI: return <XaiIcon {...props} />;
        case AI_PROVIDER.DEEPSEEK: return <DeepSeekIcon {...props} />;
        default: { const _exhaustive: never = provider; return _exhaustive; }
    }
}


function ProviderIcon({ provider, viaProvider, className = "text-muted" }: { provider: AiProvider; viaProvider?: AiProvider; className?: string }) {
    const markSize = provider === AI_PROVIDER.OPENAI ? "size-6" : "size-4";
    if (viaProvider === AI_PROVIDER.OPENCODE && provider !== AI_PROVIDER.OPENCODE)
        return <span aria-hidden="true" className={`relative inline-grid size-5 shrink-0 place-items-center ${className}`}>
            <ProviderMark provider={provider} className={markSize} />
            <ProviderMark provider={AI_PROVIDER.OPENCODE} viaProvider={viaProvider} className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-surface-raised p-px" />
        </span>;

    return <ProviderMark provider={provider} className={`${markSize} shrink-0 ${className}`} />;
}


function isReasoningEffort(value: string): value is "low" | "medium" | "high" {
    return value === "low" || value === "medium" || value === "high";
}


function ReasoningEffortSelect({ value, onChange }: { value?: ModelPreferences["reasoningEffort"]; onChange: (value: NonNullable<ModelPreferences["reasoningEffort"]>) => void }) {
    const intl = useIntl();
    return <div className="mt-3">
        <Select aria-label={intl.formatMessage({ id: "settings.reasoningEffort" })} title={intl.formatMessage({ id: "settings.reasoningEffortHint" })} value={value ?? "medium"} onChange={(event) => {
            if (isReasoningEffort(event.target.value))
                onChange(event.target.value);
        }}><option value="low">{intl.formatMessage({ id: "settings.reasoningLow" })}</option>
            <option value="medium">{intl.formatMessage({ id: "settings.reasoningMedium" })}</option>
            <option value="high">{intl.formatMessage({ id: "settings.reasoningHigh" })}</option>
        </Select>
    </div>;
}


interface ModelSelectProps { value: string; models: AvailableAiModel[]; favorites: string[]; placeholder: string; allowEmpty?: boolean; disabled?: boolean; label: string; "aria-describedby"?: string; onChange: (value: string) => void; onFavoritesChange: (favorites: string[]) => void }


function ModelSelect({ value, models, favorites, placeholder, allowEmpty = false, disabled, label, "aria-describedby": describedBy, onChange, onFavoritesChange }: ModelSelectProps) {
    const intl = useIntl();
    const [query, setQuery] = useState(""); const [vendor, setVendor] = useState<ModelVendor | "favorites">(AI_PROVIDER.OPENAI); const [open, setOpen] = useState(false); const [opensUpward, setOpensUpward] = useState(false);
    const select = useRef<HTMLDetailsElement>(null); const search = useRef<HTMLInputElement>(null); const selectedModel = models.find((model) => model.id === value || model.model === value); const selectedLabel = selectedModel ? modelLabel(selectedModel.model) : placeholder;
    const vendorTabs: ModelVendor[] = [AI_PROVIDER.OPENAI, AI_PROVIDER.ANTHROPIC, AI_PROVIDER.GOOGLE, AI_PROVIDER.XAI, AI_PROVIDER.DEEPSEEK, "other"]; const availableVendors = vendorTabs.filter((item) => models.some((model) => modelVendor(model.provider) === item)); const sourceVendor = selectedModel ? modelVendor(selectedModel.provider) : availableVendors[0] ?? AI_PROVIDER.OPENAI; const tabs: (ModelVendor | "favorites")[] = ["favorites", ...availableVendors]; const normalizedQuery = query.toLocaleLowerCase();
    const visibleModels = models.filter((model) => {
        const matchesVendor = vendor === "favorites" ? favorites.includes(model.id) || favorites.includes(model.model) : modelVendor(model.provider) === vendor; return modelLabel(model.model).toLocaleLowerCase().includes(normalizedQuery) && (normalizedQuery.length > 0 || (vendor === AI_PROVIDER.OPENAI && !selectedModel) || matchesVendor);
    });
    const vendorLabel = (item: ModelVendor | "favorites") => intl.formatMessage({ id: item === "favorites" ? "settings.favoriteModels" : item === "other" ? "settings.modelVendor.other" : providerMessages[item] });
    const close = () => setOpen(false);
    useEffect(() => {
        const closeOnOutsideMouseDown = (event: MouseEvent) => {
            const popup = select.current; if (popup?.open && !event.composedPath().includes(popup))
                setOpen(false);
        }; document.addEventListener("mousedown", closeOnOutsideMouseDown); return () => document.removeEventListener("mousedown", closeOnOutsideMouseDown);
    }, []);
    useEffect(() => {
        setVendor((current) => current === "favorites" ? current : sourceVendor);
    }, [sourceVendor]);
    if (disabled)
        return <div aria-label={label} aria-describedby={describedBy} aria-disabled="true" className="flex min-h-10 w-full items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink opacity-55">{selectedModel && <ProviderIcon provider={modelProvider(selectedModel.model, selectedModel.provider)} viaProvider={selectedModel.provider} />}<span className="truncate">{selectedLabel}</span><ChevronDownIcon className="absolute right-3 size-4 text-muted" /></div>;

    return <details ref={select} open={open} className="group relative" onKeyDown={(event) => {
        if (event.key === "Escape") {
            close(); select.current?.querySelector("summary")?.focus();
        }
    }}><summary role="button" aria-label={label} aria-describedby={describedBy} className="flex min-h-10 w-full cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 pr-10 text-sm leading-5 text-ink transition-colors hover:border-brand/45 hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden" onClick={(event) => {
        event.preventDefault(); setOpensUpward(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 272); setOpen(!open);
    }}>{selectedModel && <ProviderIcon provider={modelProvider(selectedModel.model, selectedModel.provider)} viaProvider={selectedModel.provider} />}
            <span className="truncate">{selectedLabel}</span>
            <ChevronDownIcon className="absolute right-3 size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className={`absolute z-10 w-full rounded-control border border-border bg-surface-raised p-1 shadow-raised ${opensUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
            <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Field ref={search} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={intl.formatMessage({ id: "settings.searchModels" })} placeholder={intl.formatMessage({ id: "settings.searchModels" })} className="pl-9 pr-10" />
                {query && <button type="button" aria-label={intl.formatMessage({ id: "settings.clearModelSearch" })} className="absolute right-0 top-1/2 inline-grid size-9 -translate-y-1/2 place-items-center rounded-control border border-transparent p-1 text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                    setQuery(""); search.current?.focus();
                }}><CloseIcon className="size-4" />
                </button>}
            </div>
            <div className="mt-1 grid h-52 grid-cols-[3rem_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col items-center gap-1 overflow-x-hidden overflow-y-auto border-r border-border [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" role="tablist" aria-label={intl.formatMessage({ id: "settings.modelVendorFilters" })} aria-orientation="vertical">
                    {tabs.map((item) => <button key={item} type="button" role="tab" title={vendorLabel(item)} aria-label={vendorLabel(item)} aria-selected={vendor === item} className={`flex size-9 shrink-0 items-center justify-center rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${vendor === item ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"}`} onClick={() => setVendor(item)}>
                        {item === "favorites" ? <StarIcon className="size-4" />
                            : <ProviderMark provider={item === "other"
                                ? AI_PROVIDER.OPENCODE : item} className={item === AI_PROVIDER.OPENAI ? "size-6" : "size-4"} />}
                    </button>)}
                </div>
                <div className="min-h-0 overflow-y-auto pl-1 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong" role="listbox" aria-label={label}>
                    {allowEmpty && <button type="button" role="option" aria-selected={!value} className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-sm text-muted hover:bg-brand-soft hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                        onChange(""); close();
                    }}>{placeholder}</button>}
                    {visibleModels.map((model) => <div key={model.id} className="flex items-center gap-1">
                        <button type="button" role="option" aria-selected={model.id === value || model.model === value} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => {
                            onChange(model.id); close();
                        }}>
                            <ProviderIcon provider={modelProvider(model.model, model.provider)} viaProvider={model.provider} />
                            <span className="truncate">{modelLabel(model.model)}</span>
                        </button>
                        <IconButton label={intl.formatMessage({ id: (favorites.includes(model.id) || favorites.includes(model.model)) ? "settings.removeFavoriteModel" : "settings.addFavoriteModel" }, { model: modelLabel(model.model) })} aria-pressed={favorites.includes(model.id) || favorites.includes(model.model)} className={favorites.includes(model.id) || favorites.includes(model.model) ? "text-brand" : undefined} onClick={() => onFavoritesChange((favorites.includes(model.id) || favorites.includes(model.model)) ? favorites.filter((favorite) => favorite !== model.id && favorite !== model.model) : [...favorites, model.id])}>
                            <StarIcon className={favorites.includes(model.id) || favorites.includes(model.model) ? "size-4 fill-current" : "size-4"} />
                        </IconButton>
                    </div>)}
                    {visibleModels.length === 0 && <p className="px-2 py-3 text-sm text-muted" role="status">{intl.formatMessage({ id: "settings.noMatchingModels" })}</p>}
                </div>
            </div>
        </div>
    </details>;
}


export function ModelAndReasoning({ model, effort, onEffortChange, "aria-describedby": describedBy }: { model: ModelSelectProps; effort?: ModelPreferences["reasoningEffort"]; onEffortChange?: (value: NonNullable<ModelPreferences["reasoningEffort"]>) => void; "aria-describedby"?: string }) {
    return <div>
        <ModelSelect {...model} aria-describedby={describedBy} />
        {onEffortChange && <ReasoningEffortSelect value={effort} onChange={onEffortChange} />}
    </div>;
}


export { modelProvider, providerMessages, skillMessages };
