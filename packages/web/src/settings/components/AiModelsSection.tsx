/* eslint-disable @stylistic/max-statements-per-line */
import { AI_PROVIDER, builtInSkills, type AiProvider, type AppModelPreference, type AvailableAiModel, type ModelPreferences } from "@skladno/shared";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDownIcon } from "../../ui/icons.js";
import { Button } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";
import { ModelAndReasoning, skillMessages } from "./AiModelSelect.js";


export function AiModelsSection({ preferences, appModel, models, settingsConnections, onRefreshModels, savePreferences, saveAppModel }: { preferences: ModelPreferences; appModel?: AppModelPreference; models: AvailableAiModel[]; settingsConnections: { active?: boolean; provider: AiProvider }[]; onRefreshModels: () => void; savePreferences: (next: ModelPreferences) => Promise<void>; saveAppModel: (next: AppModelPreference | null) => Promise<void> }) {
    const intl = useIntl(); const [specificModelsOpen, setSpecificModelsOpen] = useState(false); const specificModelsContent = useRef<HTMLDivElement>(null);
    const selectedProvider = (model: string) => model ? models.find((item) => item.id === model || item.model === model)?.provider ?? settingsConnections.find((connection) => connection.active !== false)?.provider : undefined;
    const toggleSpecificModels = () => {
        const nextOpen = !specificModelsOpen; setSpecificModelsOpen(nextOpen); if (nextOpen) {
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; window.setTimeout(() => specificModelsContent.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }), reducedMotion ? 0 : 220);
        }
    };
    const favorites = preferences.favoriteModels ?? [];
    const saveFavorites = (favoriteModels: string[]) => void savePreferences({ ...preferences, favoriteModels });
    const modelProps = (value: string, label: string, onChange: (model: string) => void, allowEmpty = false) => ({ value, models, favorites, allowEmpty, disabled: models.length === 0, label, placeholder: models.length === 0 ? intl.formatMessage({ id: "settings.noModels" }) : allowEmpty ? intl.formatMessage({ id: "settings.useDefaultModel" }) : intl.formatMessage({ id: "settings.chooseModel" }), onChange, onFavoritesChange: saveFavorites });

    return <SettingsGroup label={intl.formatMessage({ id: "settings.models" })}>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.defaultModel" })} hint={intl.formatMessage({ id: "settings.defaultModelHint" })}>
            <ModelAndReasoning model={modelProps(preferences.defaultModel, intl.formatMessage({ id: "settings.model" }), (defaultModel) => void savePreferences({ ...preferences, defaultModel }))} effort={preferences.reasoningEffort} onEffortChange={selectedProvider(preferences.defaultModel) === AI_PROVIDER.OPENAI ? (reasoningEffort) => void savePreferences({ ...preferences, reasoningEffort }) : undefined} />
            <Button className="mt-3 w-fit" variant="secondary" onClick={onRefreshModels}>{intl.formatMessage({ id: "settings.refreshModels" })}</Button>
        </SettingRow>
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.appModel" })} hint={intl.formatMessage({ id: "settings.appModelHint" })}>
            <ModelAndReasoning model={modelProps(appModel?.model ?? "", intl.formatMessage({ id: "settings.appModel" }), (model) => void saveAppModel(model ? { model, ...(appModel?.reasoningEffort ? { reasoningEffort: appModel.reasoningEffort } : {}) } : null), true)} effort={appModel?.reasoningEffort} onEffortChange={selectedProvider(appModel?.model ?? "") === AI_PROVIDER.OPENAI ? (reasoningEffort) => void saveAppModel({ model: appModel?.model ?? "", reasoningEffort }) : undefined} />
        </SettingRow>
        <div className="mt-8">
            <button type="button" aria-expanded={specificModelsOpen} aria-controls="specific-model-overrides" className="group flex min-h-9 w-full items-center gap-2 text-left text-sm font-semibold hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={toggleSpecificModels}>
                <span>{intl.formatMessage({ id: "settings.specificModels" })}</span>
                <ChevronDownIcon className={`ml-auto size-4 shrink-0 text-brand transition-transform duration-200 motion-reduce:transition-none ${specificModelsOpen ? "rotate-180" : ""}`} />
            </button>
            <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.specificModelsHint" })}</p>
            <div ref={specificModelsContent} id="specific-model-overrides" aria-hidden={!specificModelsOpen} className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${specificModelsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className={`min-h-0 ${specificModelsOpen ? "overflow-visible" : "overflow-hidden"} pt-2`}>{builtInSkills.map((skill) => <SettingRow key={skill} headingLevel={3} label={intl.formatMessage({ id: skillMessages[skill].label })} hint={intl.formatMessage({ id: skillMessages[skill].hint })}>
                    <ModelAndReasoning model={modelProps(preferences.skillOverrides[skill] ?? "", intl.formatMessage({ id: skillMessages[skill].label }), (model) => void savePreferences({ ...preferences, skillOverrides: { ...preferences.skillOverrides, [skill]: model } }), true)} effort={preferences.skillReasoningEfforts?.[skill]} onEffortChange={selectedProvider(preferences.skillOverrides[skill] ?? "") === AI_PROVIDER.OPENAI ? (reasoningEffort) => void savePreferences({ ...preferences, skillReasoningEfforts: { ...preferences.skillReasoningEfforts, [skill]: reasoningEffort } }) : undefined} />
                </SettingRow>)}
                </div>
            </div>
        </div>
    </SettingsGroup>;
}
