import { AI_PROVIDER, isAiProvider, type AiConnection, type AiProvider } from "@skladno/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Banner, Button, Field, Select } from "../../ui/primitives.js";
import { Control, SettingsGroup } from "./SettingRow.js";
import type { AiSettingsSectionProps } from "./AiSettingsTypes.js";

type ConnectionMethod = "managed" | "environment-variable";

const providerMessages: Record<AiProvider, "settings.provider.openai" | "settings.provider.opencode" | "settings.provider.anthropic" | "settings.provider.google" | "settings.provider.xai" | "settings.provider.deepseek"> = {
    [AI_PROVIDER.OPENAI]: "settings.provider.openai",
    [AI_PROVIDER.OPENCODE]: "settings.provider.opencode",
    [AI_PROVIDER.ANTHROPIC]: "settings.provider.anthropic",
    [AI_PROVIDER.GOOGLE]: "settings.provider.google",
    [AI_PROVIDER.XAI]: "settings.provider.xai",
    [AI_PROVIDER.DEEPSEEK]: "settings.provider.deepseek",
};


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


export function AiConnectionsSection(props: Pick<AiSettingsSectionProps, "settings" | "connectionProvider" | "connectionName" | "environmentName" | "managedConnectionName" | "apiKey" | "connectionError" | "setConnectionProvider" | "setConnectionName" | "setEnvironmentName" | "setManagedConnectionName" | "setApiKey" | "onAddConnection" | "onAddManagedConnection" | "onSetConnectionActive" | "onRequestConnectionRename" | "canRenameManagedConnection" | "onRequestConnectionRemoval">) {
    const intl = useIntl();
    const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod | undefined>(props.onAddManagedConnection ? undefined : "environment-variable");
    const providerLabel = (provider: AiProvider) => intl.formatMessage({ id: providerMessages[provider] });
    const providerControl = <>
        <Control label={intl.formatMessage({ id: "settings.provider" })} hint={intl.formatMessage({ id: "settings.providerHint" })}>
            <Select aria-label={intl.formatMessage({ id: "settings.provider" })} value={props.connectionProvider} onChange={(event) => {
                if (isAiProvider(event.target.value))
                    props.setConnectionProvider(event.target.value);
            }}>
                {Object.values(AI_PROVIDER).map((provider) => <option key={provider} value={provider}>{providerLabel(provider)}</option>)}
            </Select>
        </Control>
        <p className="mt-3 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.providerLimitations" })}</p>
    </>;
    const textFieldPaste = (value: string, setValue: (next: string) => void) => (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = event.clipboardData.getData("text");
        if (!pasted)
            return;

        event.preventDefault();
        setValue(pasteIntoField(value, pasted, event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
    };

    return <SettingsGroup label={intl.formatMessage({ id: "settings.connections" })}>
        {props.settings.connections.length > 0 && <div className="mt-6 mb-8">
            <h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.configuredConnections" })}</h3>
            <p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.configuredConnectionsHint" })}</p>
            <div className="mt-4 grid gap-2">{props.settings.connections.filter((connection): connection is AiConnection => Boolean(connection)).map((connection) => <div key={connection.id} className="flex flex-col gap-3 rounded-control border border-border bg-surface-raised px-3 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{connection.label}</p>{connection.active !== false && <p className="inline-flex min-h-8 items-center rounded-control border border-brand bg-brand-soft px-2 py-1 text-xs font-semibold text-brand" role="status">{intl.formatMessage({ id: "settings.activeConnectionShort" })}</p>}</div><p className="mt-1 truncate text-xs text-muted">{providerLabel(connection.provider)}</p><p className="truncate text-xs text-muted">{credentialSourceLabel(connection, intl.formatMessage({ id: "settings.managedCredential" }))}</p></div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{props.onRequestConnectionRename && (credentialSource(connection).kind !== "managed" || props.canRenameManagedConnection) && <Button className="!px-2" variant="quiet" onClick={() => props.onRequestConnectionRename?.(connection)}>{intl.formatMessage({ id: "settings.renameConnectionShort" })}</Button>}<Button className="!px-2" variant="quiet" onClick={() => props.onSetConnectionActive(connection.id, connection.active === false)}>{intl.formatMessage({ id: connection.active === false ? "settings.activateConnectionShort" : "settings.deactivateConnectionShort" })}</Button><Button className="!px-2" variant="danger" onClick={() => props.onRequestConnectionRemoval(connection)}>{intl.formatMessage({ id: "settings.removeConnectionShort" })}</Button></div>
            </div>)}</div>
        </div>}
        {props.onAddManagedConnection && <div className="mt-6"><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.chooseConnectionMethod" })}</h3><p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.chooseConnectionMethodHint" })}</p><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={intl.formatMessage({ id: "settings.chooseConnectionMethod" })}><Button variant={connectionMethod === "managed" ? "secondary" : "quiet"} aria-pressed={connectionMethod === "managed"} onClick={() => setConnectionMethod("managed")}>{intl.formatMessage({ id: "settings.apiKey" })}</Button><Button variant={connectionMethod === "environment-variable" ? "secondary" : "quiet"} aria-pressed={connectionMethod === "environment-variable"} onClick={() => setConnectionMethod("environment-variable")}>{intl.formatMessage({ id: "settings.environmentVariable" })}</Button></div></div>}
        {connectionMethod === "managed" && <div className="mt-6 mb-8"><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.addApiKey" })}</h3><p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.addApiKeyHint" })}</p><div className="mt-4 border-l border-border-strong pl-4"><div className="mb-4">{providerControl}</div><div className="grid gap-4"><Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}><Field type="text" value={props.managedConnectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => props.setManagedConnectionName(event.target.value)} /></Control><Control label={intl.formatMessage({ id: "settings.apiKey" })} hint={intl.formatMessage({ id: "settings.apiKeyHint" })}><Field type="password" value={props.apiKey} placeholder={intl.formatMessage({ id: "settings.apiKeyPlaceholder" })} autoComplete="off" onChange={(event) => props.setApiKey(event.target.value)} /></Control></div><div className="mt-4"><Button className="w-fit" variant="secondary" onClick={props.onAddManagedConnection}>{intl.formatMessage({ id: "settings.addApiKeyButton" })}</Button></div></div></div>}
        {connectionMethod === "environment-variable" && <div className="mt-6 mb-8"><h3 className="text-sm font-semibold">{intl.formatMessage({ id: "settings.addConnection" })}</h3><p className="mt-1 text-sm leading-5 text-muted">{intl.formatMessage({ id: "settings.connectionHint" })}</p><div className="mt-4 border-l border-border-strong pl-4"><div className="mb-4">{providerControl}</div><div className="grid gap-4"><Control label={intl.formatMessage({ id: "settings.connectionName" })} hint={intl.formatMessage({ id: "settings.connectionNameHint" })}><Field type="text" value={props.connectionName} placeholder={intl.formatMessage({ id: "settings.connectionNamePlaceholder" })} onChange={(event) => props.setConnectionName(event.target.value)} onPaste={textFieldPaste(props.connectionName, props.setConnectionName)} /></Control><Control label={intl.formatMessage({ id: "settings.environmentName" })} hint={intl.formatMessage({ id: "settings.environmentNameHint" })}><Field type="text" value={props.environmentName} placeholder={intl.formatMessage({ id: "settings.environmentNamePlaceholder" })} onChange={(event) => props.setEnvironmentName(event.target.value)} onPaste={textFieldPaste(props.environmentName, props.setEnvironmentName)} /></Control></div>{props.connectionError && <Banner className="mt-4" tone="warning" role="alert"><span>{props.connectionError}</span></Banner>}<div className="mt-4"><Button className="w-fit" variant="secondary" onClick={props.onAddConnection}>{intl.formatMessage({ id: "settings.addConnectionButton" })}</Button></div></div></div>}
    </SettingsGroup>;
}
