import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { DesktopUpdateClient, DesktopUpdateState } from "@skladno/shared";
import { Button, Dialog } from "../../ui/primitives.js";
import { SettingRow, SettingsGroup } from "./SettingRow.js";


export function UpdatesSettingsGroup({ client, desktop }: { client: DesktopUpdateClient | undefined; desktop: boolean }) {
    const intl = useIntl();
    const [state, setState] = useState<DesktopUpdateState>();
    const [networkPermissionOpen, setNetworkPermissionOpen] = useState(false);

    useEffect(() => {
        if (!client)
            return;

        void client.getState().then(setState).catch(() => undefined);
        return client.subscribe(setState);
    }, [client]);

    if (!desktop)
        return null;

    if (!client)
        return <SettingsGroup label={intl.formatMessage({ id: "settings.updates" })}>
            <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateStatus" })} hint={intl.formatMessage({ id: "settings.updateStatusUnavailableHint" })} status={intl.formatMessage({ id: "settings.updatesUnavailable" })}><span /></SettingRow>
        </SettingsGroup>;

    if (!state)
        return null;

    const details = state.kind === "available" || state.kind === "downloading" || state.kind === "ready" ? state : undefined;
    const status = state.kind === "unsupported" ? intl.formatMessage({ id: "settings.updatesUnavailable" })
        : !state.networkAccess ? intl.formatMessage({ id: "settings.updatesNetworkAccessRequired" })
            : state.kind === "checking" ? intl.formatMessage({ id: "settings.updatesChecking" })
                : state.kind === "failed" ? intl.formatMessage({ id: `settings.updatesError.${state.error}` })
                    : details ? intl.formatMessage({ id: "settings.updatesAvailable" }, { version: details.version })
                        : intl.formatMessage({ id: "settings.updatesCurrent" });

    return <SettingsGroup label={intl.formatMessage({ id: "settings.updates" })}>
        <div id="settings-updates" tabIndex={-1} />
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateNetworkAccess" })} hint={intl.formatMessage({ id: "settings.updateNetworkAccessHint" })}>
            <button type="button" role="switch" aria-checked={state.networkAccess} aria-label={intl.formatMessage({ id: "settings.updateNetworkAccess" })} className="group inline-flex min-h-9 appearance-none items-center gap-2 border-0 bg-transparent px-0 py-1 text-xs font-semibold text-ink hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => state.networkAccess ? void client.setNetworkAccess(false).then(setState) : setNetworkPermissionOpen(true)}>
                <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors group-hover:border-brand ${state.networkAccess ? "border-brand bg-brand" : "border-border-strong bg-surface-raised"}`}>
                    <span className={`size-4 rounded-full border border-border-strong bg-surface transition-transform ${state.networkAccess ? "translate-x-4" : "translate-x-0"}`} />
                </span>
                <span>{intl.formatMessage({ id: state.networkAccess ? "settings.on" : "settings.off" })}</span>
            </button>
        </SettingRow>
        {state.networkAccess &&
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.automaticUpdates" })} hint={intl.formatMessage({ id: "settings.automaticUpdatesHint" })}>
            <button type="button" role="switch" aria-checked={state.automaticChecks} aria-label={intl.formatMessage({ id: "settings.automaticUpdates" })} className="group inline-flex min-h-9 appearance-none items-center gap-2 border-0 bg-transparent px-0 py-1 text-xs font-semibold text-ink hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" onClick={() => void client.setAutomaticChecks(!state.automaticChecks).then(setState)}>
                <span aria-hidden="true" className={`relative inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors group-hover:border-brand ${state.automaticChecks ? "border-brand bg-brand" : "border-border-strong bg-surface-raised"}`}>
                    <span className={`size-4 rounded-full border border-border-strong bg-surface transition-transform ${state.automaticChecks ? "translate-x-4" : "translate-x-0"}`} />
                </span>
                <span>{intl.formatMessage({ id: state.automaticChecks ? "settings.on" : "settings.off" })}</span>
            </button>
        </SettingRow>}
        <SettingRow headingLevel={3} label={intl.formatMessage({ id: "settings.updateStatus" })} hint={intl.formatMessage({ id: "settings.updateStatusHint" }, { version: state.currentVersion })} status={status} action={<div className="flex flex-wrap gap-2">
            {state.kind !== "unsupported" && state.networkAccess && <Button variant="secondary" state={state.kind === "checking" ? "loading" : "default"} onClick={() => void client.checkNow().then(setState)}>{intl.formatMessage({ id: "settings.checkNow" })}</Button>}
            {details && <Button variant="secondary" onClick={() => void client.openReleaseNotes()}>{intl.formatMessage({ id: "settings.viewReleaseNotes" })}</Button>}
            {state.kind === "available" && <Button onClick={() => void client.download().then(setState)}>{intl.formatMessage({ id: "settings.downloadUpdate" })}</Button>}
            {state.kind === "ready" && <Button onClick={() => void client.restartAndUpdate()}>{intl.formatMessage({ id: "settings.restartAndUpdate" })}</Button>}
            {state.kind === "failed" && <Button variant="secondary" onClick={() => void client.checkNow().then(setState)}>{intl.formatMessage({ id: "settings.retry" })}</Button>}
            {state.kind !== "unsupported" && <Button variant="quiet" onClick={() => void client.openRecoveryGuide()}>{intl.formatMessage({ id: "settings.updateRecovery" })}</Button>}
        </div>}>
            {details?.summary ? <span>{details.summary}</span> : <span />}
        </SettingRow>
        {state.kind !== "unsupported" && <p className="mt-3 text-xs leading-5 text-muted">{intl.formatMessage({ id: "settings.updatesPrivacy" })}</p>}
        {networkPermissionOpen && <Dialog className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl" open aria-labelledby="update-network-permission-title" onCancel={(event) => {
            event.preventDefault();
            setNetworkPermissionOpen(false);
        }}>
            <h2 id="update-network-permission-title" className="text-lg font-semibold">{intl.formatMessage({ id: "settings.updateNetworkPermissionTitle" })}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{intl.formatMessage({ id: "settings.updateNetworkPermissionDescription" })}</p>
            <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" autoFocus onClick={() => setNetworkPermissionOpen(false)}>{intl.formatMessage({ id: "editor.cancel" })}</Button>
                <Button onClick={() => void client.setNetworkAccess(true).then((next) => {
                    setState(next);
                    setNetworkPermissionOpen(false);
                })}>{intl.formatMessage({ id: "settings.allowNetworkAccess" })}</Button>
            </div>
        </Dialog>}
    </SettingsGroup>;
}
