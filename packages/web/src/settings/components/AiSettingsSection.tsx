import { builtInSkills, type ApplicationSettingsSnapshot, type BuiltInSkillId, type ModelPreferences, type OpenAiConnection } from "@skladno/shared";
import { useIntl } from "react-intl";
import { Banner, Button, Field, Select } from "../../ui/primitives.js";
import { Control, SettingRow } from "./SettingRow.js";

const skillMessages: Record<BuiltInSkillId, { label: "assistant.skill.talkingPoints.label" | "assistant.skill.narrativeDraft.label" | "assistant.skill.flowAndClarity.label" | "assistant.skill.factChecking.label" | "assistant.skill.styleReview.label" | "assistant.skill.translation.label"; hint: "assistant.skill.talkingPoints.hint" | "assistant.skill.narrativeDraft.hint" | "assistant.skill.flowAndClarity.hint" | "assistant.skill.factChecking.hint" | "assistant.skill.styleReview.hint" | "assistant.skill.translation.hint" }> = {
    talking_points: { label: "assistant.skill.talkingPoints.label", hint: "assistant.skill.talkingPoints.hint" },
    narrative_draft: { label: "assistant.skill.narrativeDraft.label", hint: "assistant.skill.narrativeDraft.hint" },
    flow_and_clarity: { label: "assistant.skill.flowAndClarity.label", hint: "assistant.skill.flowAndClarity.hint" },
    fact_checking: { label: "assistant.skill.factChecking.label", hint: "assistant.skill.factChecking.hint" },
    style_review: { label: "assistant.skill.styleReview.label", hint: "assistant.skill.styleReview.hint" },
    translation: { label: "assistant.skill.translation.label", hint: "assistant.skill.translation.hint" },
};


function pasteIntoField(current: string, pasted: string, selectionStart: number | null, selectionEnd: number | null): string {
    const start = selectionStart ?? current.length;
    const end = selectionEnd ?? start;

    return `${current.slice(0, start)}${pasted}${current.slice(end)}`;
}


export function AiSettingsSection({ settings, preferences, models, connectionName, environmentName, connectionError, setConnectionName, setEnvironmentName, onAddConnection, onSetActiveConnection, onRequestConnectionRemoval, onRefreshModels, savePreferences }: {
    settings: ApplicationSettingsSnapshot;
    preferences: ModelPreferences;
    models: string[];
    connectionName: string;
    environmentName: string;
    connectionError?: string;
    setConnectionName: (value: string) => void;
    setEnvironmentName: (value: string) => void;
    onAddConnection: () => void;
    onSetActiveConnection: (connectionId: string) => void;
    onRequestConnectionRemoval: (connection: OpenAiConnection) => void;
    onRefreshModels: () => void;
    savePreferences: (next: ModelPreferences) => Promise<void>;
}) {
    const intl = useIntl();

    return <>
        <SettingRow label={intl.formatMessage({ id: "settings.addConnection" })} hint={intl.formatMessage({ id: "settings.connectionHint" })}><div className="grid gap-4"><Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}><Field type="text" readOnly={false} value={connectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => setConnectionName(event.target.value)} onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!pasted)
                return;

            event.preventDefault();
            setConnectionName(pasteIntoField(connectionName, pasted, event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
        }} /></Control><Control label={intl.formatMessage({ id: "settings.environmentName" })} hint={intl.formatMessage({ id: "settings.environmentNameHint" })}><Field type="text" readOnly={false} value={environmentName} placeholder={intl.formatMessage({ id: "settings.environmentNamePlaceholder" })} onChange={(event) => setEnvironmentName(event.target.value)} onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!pasted)
                return;

            event.preventDefault();
            setEnvironmentName(pasteIntoField(environmentName, pasted, event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
        }} /></Control>{connectionError && <Banner tone="warning" role="alert"><span>{connectionError}</span></Banner>}<Button className="w-fit" variant="secondary" onClick={onAddConnection}>{intl.formatMessage({ id: "settings.addConnectionButton" })}</Button></div></SettingRow>
        {settings.connections.length > 0 && <SettingRow label={intl.formatMessage({ id: "settings.configuredConnections" })} hint={intl.formatMessage({ id: "settings.configuredConnectionsHint" })}><div className="grid gap-2">{settings.connections.map((connection) => <div key={connection.id} className="flex flex-col gap-3 rounded-control border border-border bg-surface-raised px-3 py-2 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{connection.label}</p><p className="mt-1 truncate text-xs text-muted">{connection.environmentVariableName}</p></div><div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{connection.id === settings.activeConnectionId ? <p className="text-xs text-muted" role="status">{intl.formatMessage({ id: "settings.activeConnection" })}</p> : <><Button variant="quiet" onClick={() => onSetActiveConnection(connection.id)}>{intl.formatMessage({ id: "settings.useConnection" })}</Button><Button variant="danger" onClick={() => onRequestConnectionRemoval(connection)}>{intl.formatMessage({ id: "settings.removeConnection" })}</Button></>}</div></div>)}</div></SettingRow>}
        <SettingRow label={intl.formatMessage({ id: "settings.defaultModel" })} hint={intl.formatMessage({ id: "settings.defaultModelHint" })}><Control label={intl.formatMessage({ id: "settings.model" })} hint={intl.formatMessage({ id: "settings.modelHint" })}><Select value={preferences.defaultModel} disabled={models.length === 0} onChange={(event) => void savePreferences({ ...preferences, defaultModel: event.target.value })}><option value="">{models.length === 0 ? intl.formatMessage({ id: "settings.noModels" }) : intl.formatMessage({ id: "settings.chooseModel" })}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control><Button className="mt-3 w-fit" variant="secondary" onClick={onRefreshModels}>{intl.formatMessage({ id: "settings.refreshModels" })}</Button></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.textGenerationModel" })} hint={intl.formatMessage({ id: "settings.textGenerationModelHint" })}><Control label={intl.formatMessage({ id: "settings.model" })} hint={intl.formatMessage({ id: "settings.textGenerationModelControlHint" })}><Select value={preferences.textGenerationModel ?? ""} disabled={models.length === 0} onChange={(event) => void savePreferences({ ...preferences, textGenerationModel: event.target.value || undefined })}><option value="">{intl.formatMessage({ id: "settings.useDefaultModel" })}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control></SettingRow>
        <SettingRow label={intl.formatMessage({ id: "settings.specificModels" })} hint={intl.formatMessage({ id: "settings.specificModelsHint" })}><div className="grid gap-4">{builtInSkills.map((skill) => <Control key={skill} label={intl.formatMessage({ id: skillMessages[skill].label })} hint={intl.formatMessage({ id: skillMessages[skill].hint })}><Select value={preferences.skillOverrides[skill] ?? ""} onChange={(event) => void savePreferences({ ...preferences, skillOverrides: { ...preferences.skillOverrides, [skill]: event.target.value } })}><option value="">{intl.formatMessage({ id: "settings.useDefaultModel" })}</option>{models.map((model) => <option key={model}>{model}</option>)}</Select></Control>)}</div></SettingRow>
    </>;
}
